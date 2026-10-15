package com.resumecraft.invoices;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.resumecraft.common.DomainException;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Owner-only invoice commands; mutable draft fields and recomputed totals are saved atomically. */
@Service
public class InvoiceService {
    private final InvoiceMapper mapper;
    private final InvoiceStructureValidator validator;
    private final InvoiceNumberService numbers;
    private final ObjectMapper json;

    public InvoiceService(InvoiceMapper mapper, InvoiceStructureValidator validator,
            InvoiceNumberService numbers, ObjectMapper json) {
        this.mapper = mapper;
        this.validator = validator;
        this.numbers = numbers;
        this.json = json;
    }

    public Long owner(Authentication actor) {
        if (actor == null || !actor.isAuthenticated() || actor instanceof AnonymousAuthenticationToken) {
            throw new DomainException(HttpStatus.UNAUTHORIZED, "401", "로그인이 필요합니다.", null);
        }
        var account = mapper.account(actor.getName());
        if (account == null) throw new DomainException(HttpStatus.UNAUTHORIZED, "401", "로그인이 필요합니다.", null);
        return account.id();
    }

    public InvoicePage list(Authentication actor, String type, String page, String size) {
        Long user = owner(actor);
        if (type != null && !java.util.Set.of("quote", "invoice").contains(type)) {
            InvoiceStructureValidator.invalid("type");
        }
        int p = 1;
        try {
            if (page != null) p = Integer.parseInt(page);
            if (p < 1) InvoiceStructureValidator.invalid("page");
        } catch (NumberFormatException e) { InvoiceStructureValidator.invalid("page"); }
        if (size != null && !size.equals("20")) InvoiceStructureValidator.invalid("size");
        return new InvoicePage(mapper.list(user, type, (p - 1L) * 20).stream().map(this::snapshot).toList(),
                p, 20, mapper.count(user, type));
    }

    public Invoice get(Authentication actor, String id) {
        return snapshot(required(id, owner(actor)));
    }

    public CreatedInvoice create(Authentication actor, JsonNode request) {
        Long user = owner(actor);
        String type = validator.create(request);
        Long id = numbers.create(user, type, number -> {
            var content = InvoiceDefaults.content(json, type, mapper.latest(user));
            return mapper.insert(user, type, number, null, type.equals("quote") ? "새 견적서" : "새 청구서",
                    content.toString(), InvoiceCalculator.calculate(content));
        });
        return new CreatedInvoice(id.toString());
    }

    /** No PDF-required checks: blank drafts and paid invoices remain editable. */
    @Transactional
    public void save(Authentication actor, String id, JsonNode request) {
        Long user = owner(actor);
        InvoiceRow old = required(id, user);
        InvoiceWrite write = validator.validate(request, old.docType());
        JsonNode photo = write.content().get("stampPhotoId");
        if (!photo.isNull() && !mapper.ownsPhoto(photo.asText(), user)) throw missing();
        if (mapper.save(old.id(), user, write, write.content().toString(),
                InvoiceCalculator.calculate(write.content())) != 1) throw missing();
    }

    @Transactional
    public void delete(Authentication actor, String id) {
        Long user = owner(actor);
        if (mapper.delete(required(id, user).id(), user) != 1) throw missing();
    }

    public InvoiceRow required(String id, Long user) {
        try {
            InvoiceRow row = mapper.find(Long.valueOf(id), user);
            if (row == null) throw missing();
            return row;
        } catch (NumberFormatException e) { throw missing(); }
    }

    private DomainException missing() {
        return new DomainException(HttpStatus.NOT_FOUND, "404", "문서를 찾을 수 없습니다.", null);
    }

    public Invoice snapshot(InvoiceRow row) {
        try {
            return new Invoice(row.id().toString(), row.userId().toString(), row.docType(), row.docNo(),
                    row.sourceQuoteId() == null ? null : row.sourceQuoteId().toString(), row.title(),
                    json.readTree(row.content()), row.supplyAmount(), row.vatAmount(), row.totalAmount(),
                    row.paid(), row.deleted(), row.createdAt().toString(), row.updatedAt().toString());
        } catch (Exception e) { throw new IllegalStateException("저장 자료를 읽지 못했습니다."); }
    }
}
