package com.resumecraft.invoicesops;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.resumecraft.common.DomainException;
import java.sql.SQLException;
import java.time.Instant;
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

/** Creates owner-scoped copies with one completely rolled-back number retry, never mutating the source. */
@Service
public class InvoiceTransferService {
    private final InvoiceTransferMapper mapper;
    private final ObjectMapper json;
    private final TransactionTemplate attempt;

    public InvoiceTransferService(
            InvoiceTransferMapper mapper,
            ObjectMapper json,
            PlatformTransactionManager transactions
    ) {
        this.mapper = mapper;
        this.json = json;
        this.attempt = new TransactionTemplate(transactions);
        this.attempt.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.attempt.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);
    }

    /** A duplicate resets source linkage and payment, but keeps item identity and all remaining content. */
    public CreatedInvoiceCopy duplicate(Authentication actor, String id) {
        return create(actor, id, false);
    }

    /** Conversion is repeatable and copies only the fields applicable to the new invoice. */
    public CreatedInvoiceCopy convert(Authentication actor, String id) {
        return create(actor, id, true);
    }

    private CreatedInvoiceCopy create(Authentication actor, String id, boolean convert) {
        if (actor == null || !actor.isAuthenticated() || actor instanceof AnonymousAuthenticationToken) {
            throw new DomainException(HttpStatus.UNAUTHORIZED, "401", "로그인이 필요합니다.", null);
        }
        for (int index = 0; index < 2; index++) {
            try {
                Long key = attempt.execute(status -> materialize(actor.getName(), id, convert));
                return new CreatedInvoiceCopy(key.toString());
            } catch (RuntimeException failure) {
                // execute() has rolled the failed transaction back before the next MAX query starts.
                if (!numberCollision(failure)) throw failure;
                if (index == 1) conflict("DOCUMENT_NUMBER_CONFLICT", "문서번호가 충돌했습니다. 다시 시도해 주세요.");
            }
        }
        throw new IllegalStateException("번호 발급을 완료하지 못했습니다.");
    }

    private Long materialize(String identity, String id, boolean convert) {
        Long userId = mapper.account(identity);
        if (userId == null) {
            throw new DomainException(HttpStatus.UNAUTHORIZED, "401", "로그인이 필요합니다.", null);
        }
        Long sourceId;
        try {
            if (!id.matches("[1-9][0-9]*")) throw new NumberFormatException();
            sourceId = Long.valueOf(id);
        } catch (NumberFormatException failure) {
            throw missing();
        }
        InvoiceTransferRow source = mapper.find(sourceId, userId);
        if (source == null) throw missing();
        if (convert && !"quote".equals(source.docType())) {
            conflict("NOT_A_QUOTE", "견적서만 청구서로 변환할 수 있습니다.");
        }
        LocalDate date = seoulDate(Instant.now());
        String type = convert ? "invoice" : source.docType();
        String prefix = ("quote".equals(type) ? "Q-" : "I-") + date.getYear() + "-";
        int next = mapper.maximum(userId, type, prefix) + 1;
        if (next > 9999) conflict("DOCUMENT_NUMBER_EXHAUSTED", "올해 문서번호를 모두 사용했습니다.");
        ObjectNode original;
        try {
            original = (ObjectNode) json.readTree(source.content());
        } catch (JsonProcessingException failure) {
            throw new IllegalStateException("저장 자료를 읽지 못했습니다.");
        }
        ObjectNode content = original.deepCopy();
        if (convert) {
            content = json.createObjectNode();
            for (String field : new String[]{"supplier", "client", "items", "vatMode", "notes",
                    "stampPhotoId", "color"}) {
                content.set(field, original.get(field));
            }
            content.put("dueDate", "");
            content.put("bankAccount", "");
        }
        content.put("issueDate", date.toString());
        long sum = 0;
        for (var item : content.path("items")) {
            sum = Math.addExact(sum, Math.multiplyExact(item.path("qty").longValue(),
                    item.path("unitPrice").longValue()));
        }
        String vatMode = content.path("vatMode").asText();
        long vat = switch (vatMode) {
            case "separate" -> sum / 10;
            case "included" -> sum / 11;
            case "exempt" -> 0;
            default -> throw new IllegalStateException("저장된 부가세 방식을 확인해 주세요.");
        };
        long supply = "included".equals(vatMode) ? sum - vat : sum;
        long total = "separate".equals(vatMode) ? Math.addExact(sum, vat) : sum;
        return mapper.insert(new InvoiceTransferInsert(
                userId, type, prefix + String.format(Locale.ROOT, "%04d", next),
                convert ? source.id() : null, convert ? source.title() : source.title() + " (사본)",
                content.toString(), supply, vat, total
        ));
    }

    static LocalDate seoulDate(Instant instant) {
        return instant.atZone(ZoneId.of("Asia/Seoul")).toLocalDate();
    }

    private boolean numberCollision(Throwable failure) {
        for (Throwable cause = failure; cause != null; cause = cause.getCause()) {
            if (cause instanceof SQLException sql && "23505".equals(sql.getSQLState())
                    && sql.getMessage() != null && sql.getMessage().contains("uq_invoice_user_doc_no")) {
                return true;
            }
        }
        return false;
    }

    private DomainException missing() {
        return new DomainException(HttpStatus.NOT_FOUND, "404", "문서를 찾을 수 없습니다.", null);
    }

    private void conflict(String code, String message) {
        throw new DomainException(HttpStatus.CONFLICT, code, message, null);
    }
}
