package com.resumecraft.invoicesops;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.resumecraft.auth.UserMapper;
import com.resumecraft.common.DomainException;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/** Copies persisted owner snapshots, allocating numbers in fresh transactions after a definite rollback. */
@Service
public class InvoiceCopyService {
    private final InvoiceCopyMapper mapper;
    private final UserMapper users;
    private final ObjectMapper json;
    private final TransactionTemplate attempt;

    public InvoiceCopyService(
            InvoiceCopyMapper mapper,
            UserMapper users,
            ObjectMapper json,
            PlatformTransactionManager transactions
    ) {
        this.mapper = mapper;
        this.users = users;
        this.json = json;
        this.attempt = new TransactionTemplate(transactions);
        this.attempt.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    /** Same-type copy resets only title, issue date, paid state and source linkage. */
    public CreatedInvoiceCopy duplicate(Authentication actor, String id) {
        return copy(actor, id, false);
    }

    /** Conversion creates an independent invoice; repeated conversion never changes or locks out the quote. */
    public CreatedInvoiceCopy convert(Authentication actor, String id) {
        return copy(actor, id, true);
    }

    private CreatedInvoiceCopy copy(Authentication actor, String id, boolean conversion) {
        if (actor == null || !actor.isAuthenticated() || actor instanceof AnonymousAuthenticationToken) {
            throw new DomainException(HttpStatus.UNAUTHORIZED, "401", "로그인이 필요합니다.", null);
        }
        var account = users.findByEmail(actor.getName());
        if (account == null) {
            throw new DomainException(HttpStatus.UNAUTHORIZED, "401", "로그인이 필요합니다.", null);
        }
        Long key;
        try {
            key = Long.valueOf(id);
        } catch (NumberFormatException failure) {
            throw missing();
        }
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
        for (int trial = 0; trial < 2; trial++) {
            try {
                return attempt.execute(status -> materialize(key, account.id(), conversion, today));
            } catch (RuntimeException failure) {
                // Retry only this schema's document-number unique violation, never FK/other uniqueness errors.
                if (!numberCollision(failure)) {
                    throw failure;
                }
                if (trial == 1) {
                    throw conflict("DOCUMENT_NUMBER_CONFLICT", "문서번호가 충돌했습니다. 다시 시도해 주세요.");
                }
            }
        }
        throw new IllegalStateException("문서번호 발급 실패");
    }

    private CreatedInvoiceCopy materialize(Long id, Long owner, boolean conversion, LocalDate today) {
        InvoiceCopyRow source = mapper.find(id, owner);
        if (source == null) {
            throw missing();
        }
        if (conversion && !"quote".equals(source.docType())) {
            throw conflict("NOT_A_QUOTE", "견적서만 청구서로 변환할 수 있습니다.");
        }
        ObjectNode content;
        try {
            content = (ObjectNode) json.readTree(source.content());
        } catch (JsonProcessingException failure) {
            throw new IllegalStateException("저장 자료를 읽지 못했습니다.");
        }
        content.put("issueDate", today.toString());
        if (conversion) {
            content.remove("validUntil");
            content.put("dueDate", "");
            content.put("bankAccount", "");
        }
        String type = conversion ? "invoice" : source.docType();
        String prefix = ("quote".equals(type) ? "Q-" : "I-") + today.getYear() + "-";
        int maximum = mapper.maximum(owner, type, prefix);
        if (maximum >= 9999) {
            throw conflict("DOCUMENT_NUMBER_EXHAUSTED", "올해 문서번호를 모두 사용했습니다.");
        }
        String number = prefix + String.format(Locale.ROOT, "%04d", maximum + 1);
        long sum = 0;
        for (var item : content.path("items")) {
            sum = Math.addExact(sum, Math.multiplyExact(item.path("qty").longValue(),
                    item.path("unitPrice").longValue()));
        }
        long vat = switch (content.path("vatMode").asText()) {
            case "separate" -> sum / 10;
            case "included" -> sum / 11;
            case "exempt" -> 0;
            default -> throw new IllegalStateException("저장된 부가세 방식을 확인해 주세요.");
        };
        boolean included = "included".equals(content.path("vatMode").asText());
        long supply = included ? sum - vat : sum;
        long total = included ? sum : Math.addExact(sum, vat);
        Long created = mapper.insert(owner, type, number, conversion ? source.id() : null,
                conversion ? source.title() : source.title() + " (사본)", content.toString(), supply, vat, total);
        return new CreatedInvoiceCopy(created.toString());
    }

    private boolean numberCollision(Throwable failure) {
        for (Throwable cause = failure; cause != null; cause = cause.getCause()) {
            if (cause instanceof SQLException sql && "23505".equals(sql.getSQLState())
                    && sql.getMessage() != null && sql.getMessage().contains("invoice_user_id_doc_no_key")) {
                return true;
            }
        }
        return false;
    }

    private DomainException missing() {
        return new DomainException(HttpStatus.NOT_FOUND, "404", "문서를 찾을 수 없습니다.", null);
    }

    private DomainException conflict(String code, String message) {
        return new DomainException(HttpStatus.CONFLICT, code, message, null);
    }
}
