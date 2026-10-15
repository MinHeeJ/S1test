package com.resumecraft.invoices;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.resumecraft.common.DomainException;
import java.time.LocalDate;
import java.time.ZoneId;
import java.sql.SQLException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/** Persistent owner-only snapshots, exact calculated totals and rollback-isolated number allocation. */
@Service
public class InvoiceService {
    private final InvoiceMapper mapper;
    private final InvoiceStructureValidator validator;
    private final ObjectMapper json;
    private final TransactionTemplate creation;

    public InvoiceService(
            InvoiceMapper mapper, InvoiceStructureValidator validator,
            ObjectMapper json, PlatformTransactionManager transactions
    ) {
        this.mapper = mapper;
        this.validator = validator;
        this.json = json;
        this.creation = new TransactionTemplate(transactions);
        this.creation.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public Long actor(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) unauthorized();
        var account = mapper.account(authentication.getName());
        if (account == null) unauthorized();
        return account.id();
    }

    @Transactional(readOnly = true)
    public InvoicePage list(Authentication authentication, String type, String page, String size) {
        Long userId = actor(authentication);
        if (type != null && !type.equals("quote") && !type.equals("invoice")) {
            InvoiceStructureValidator.invalid("type");
        }
        int number = positive(page, "page", 1);
        if (positive(size, "size", 20) != 20) InvoiceStructureValidator.invalid("size");
        return new InvoicePage(mapper.list(userId, type, (number - 1L) * 20).stream()
                .map(this::publicInvoice).toList(), number, 20, mapper.count(userId, type));
    }

    @Transactional(readOnly = true)
    public Invoice get(Authentication authentication, String id) {
        return publicInvoice(required(id, actor(authentication)));
    }

    /** Each unique-conflict attempt ends its transaction before another MAX read is allowed. */
    public CreatedInvoice create(Authentication authentication, JsonNode request) {
        Long userId = actor(authentication);
        String type = validator.create(request);
        for (int attempt = 0; attempt < 2; attempt++) {
            try {
                return creation.execute(status -> {
                    LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
                    String prefix = (type.equals("quote") ? "Q-" : "I-") + today.getYear() + "-";
                    int next = mapper.maximum(userId, prefix) + 1;
                    if (next > 9999) conflict("DOCUMENT_NUMBER_EXHAUSTED");
                    InvoiceRow recent = mapper.latest(userId);
                    JsonNode content = InvoiceDefaults.content(json, type, today,
                            recent == null ? null : readContent(recent.content()));
                    Long key = mapper.insert(userId, type, prefix + String.format(java.util.Locale.ROOT, "%04d", next),
                            null, type.equals("quote") ? "새 견적서" : "새 청구서", content.toString(), 0, 0, 0);
                    return new CreatedInvoice(key.toString());
                });
            } catch (DuplicateKeyException error) {
                if (!numberConflict(error)) throw error;
                if (attempt == 1) conflict("DOCUMENT_NUMBER_CONFLICT");
            }
        }
        throw new IllegalStateException("번호 발급 실패");
    }

    /** Validate all mutable fields before a single update; photo originals and immutable fields never change. */
    @Transactional
    public void save(Authentication authentication, String id, JsonNode body) {
        Long userId = actor(authentication);
        InvoiceRow row = required(id, userId);
        InvoiceWrite write = validator.write(body, row.docType());
        JsonNode photo = write.content().get("stampPhotoId");
        if (!photo.isNull() && !mapper.ownsPhoto(photo.asText(), userId)) notFound();
        var amount = InvoiceCalculator.calculate(write.content());
        changed(mapper.save(row.id(), userId, write.title(), write.content().toString(), write.paid(),
                amount.supply(), amount.vat(), amount.total()));
    }

    /** Soft deletion preserves document numbers, timestamps, source links and original images. */
    @Transactional
    public void delete(Authentication authentication, String id) {
        Long userId = actor(authentication);
        changed(mapper.delete(required(id, userId).id(), userId));
    }

    public InvoiceRow required(String id, Long userId) {
        Long key;
        try {
            if (!id.matches("[0-9]+")) throw new NumberFormatException();
            key = Long.valueOf(id);
        } catch (NumberFormatException error) {
            throw missing();
        }
        InvoiceRow row = mapper.find(key, userId);
        if (row == null) notFound();
        return row;
    }

    public JsonNode readContent(String text) {
        try {
            return json.readTree(text);
        } catch (com.fasterxml.jackson.core.JsonProcessingException error) {
            throw new IllegalStateException("저장 자료를 읽지 못했습니다.");
        }
    }

    private Invoice publicInvoice(InvoiceRow r) {
        return new Invoice(r.id().toString(), r.userId().toString(), r.docType(), r.docNo(),
                r.sourceQuoteId() == null ? null : r.sourceQuoteId().toString(), r.title(), readContent(r.content()),
                r.supplyAmount(), r.vatAmount(), r.totalAmount(), r.paid(), r.deleted(),
                r.createdAt().toString(), r.updatedAt().toString());
    }

    private int positive(String value, String field, int fallback) {
        if (value == null) return fallback;
        try {
            if (!value.matches("[0-9]+") || Integer.parseInt(value) < 1) throw new NumberFormatException();
            return Integer.parseInt(value);
        } catch (NumberFormatException error) {
            InvoiceStructureValidator.invalid(field);
            return fallback;
        }
    }

    private boolean numberConflict(Throwable error) {
        for (Throwable cause = error; cause != null; cause = cause.getCause()) {
            if (cause instanceof SQLException sql) {
                return "23505".equals(sql.getSQLState())
                        && sql.getMessage() != null && sql.getMessage().contains("uq_invoice_user_doc_no");
            }
        }
        return false;
    }

    private void changed(int count) {
        if (count != 1) notFound();
    }

    private void notFound() {
        throw missing();
    }

    private DomainException missing() {
        return new DomainException(HttpStatus.NOT_FOUND, "404", "문서를 찾을 수 없습니다.", null);
    }

    private void unauthorized() {
        throw new DomainException(HttpStatus.UNAUTHORIZED, "401", "로그인이 필요합니다.", null);
    }

    private void conflict(String code) {
        throw new DomainException(HttpStatus.CONFLICT, code, "문서번호를 발급할 수 없습니다.", null);
    }
}
