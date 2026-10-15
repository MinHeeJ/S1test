package com.resumecraft.invoices;

import com.fasterxml.jackson.databind.JsonNode;
import com.resumecraft.common.DomainException;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/** Strict invoice-only boundary; draft completeness and business-number warnings never block saving. */
@Component
public class InvoiceStructureValidator {
    public static final Set<String> COLORS = Set.of(
            "#1F3A5F", "#2563EB", "#0F766E", "#9F1239", "#C2410C", "#374151");

    public static void invalid(String field) {
        throw new DomainException(HttpStatus.BAD_REQUEST, "INVALID_STRUCTURE", "입력 형식을 확인해 주세요.", field);
    }

    private void object(JsonNode node, String field, Set<String> required, Set<String> optional) {
        if (node == null || !node.isObject()) invalid(field);
        node.fieldNames().forEachRemaining(key -> {
            if (!required.contains(key) && !optional.contains(key)) {
                invalid(field.isEmpty() ? key : field + "." + key);
            }
        });
        for (String key : required) {
            if (!node.has(key)) invalid(field.isEmpty() ? key : field + "." + key);
        }
    }

    private void text(JsonNode node, String key, String field) {
        if (!node.path(key).isTextual()) invalid(field);
    }

    public String create(JsonNode request) {
        object(request, "", Set.of("docType"), Set.of());
        if (!request.path("docType").isTextual()
                || !Set.of("quote", "invoice").contains(request.path("docType").asText())) invalid("docType");
        return request.get("docType").asText();
    }

    public InvoiceWrite validate(JsonNode request, String docType) {
        object(request, "", Set.of("title", "content", "paid"), Set.of());
        text(request, "title", "title");
        String title = request.path("title").asText();
        if (title.codePoints().allMatch(c -> Character.isWhitespace(c) || Character.isSpaceChar(c))) invalid("title");
        if (!request.path("paid").isBoolean()
                || (docType.equals("quote") && request.path("paid").asBoolean())) invalid("paid");
        JsonNode c = request.get("content");
        object(c, "content", Set.of("supplier", "client", "issueDate", "items", "vatMode", "notes",
                "stampPhotoId", "color"), Set.of("validUntil", "dueDate", "bankAccount"));
        if (c.toString().getBytes(StandardCharsets.UTF_8).length > 200000) {
            throw new DomainException(HttpStatus.PAYLOAD_TOO_LARGE, "CONTENT_TOO_LARGE",
                    "본문은 200000 bytes 이하여야 합니다.", "content");
        }
        for (String key : new String[]{"supplier", "client"}) {
            Set<String> fields = key.equals("supplier") ? Set.of("name", "bizNo", "ceo", "address", "phone")
                    : Set.of("name", "contact");
            object(c.get(key), "content." + key, fields, Set.of());
            for (String f : fields) text(c.get(key), f, "content." + key + "." + f);
        }
        for (String key : new String[]{"issueDate", "validUntil", "dueDate", "notes", "bankAccount",
                "vatMode", "color"}) {
            if (!c.has(key)) continue;
            text(c, key, "content." + key);
            if (Set.of("issueDate", "validUntil", "dueDate").contains(key)
                    && !c.get(key).asText().matches("(?:[0-9]{4}-[0-9]{2}-[0-9]{2})?")) invalid("content." + key);
        }
        if (!Set.of("separate", "included", "exempt").contains(c.path("vatMode").asText())) invalid("content.vatMode");
        if (!COLORS.contains(c.path("color").asText())) invalid("content.color");
        JsonNode photo = c.get("stampPhotoId");
        if (!photo.isNull()) {
            if (!photo.isTextual()
                    || !photo.asText().matches("[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}")) {
                invalid("content.stampPhotoId");
            }
            try { UUID.fromString(photo.asText()); } catch (IllegalArgumentException e) {
                invalid("content.stampPhotoId");
            }
        }
        JsonNode items = c.get("items");
        if (!items.isArray() || items.size() > 50) invalid("content.items");
        Set<String> ids = new HashSet<>();
        for (JsonNode item : items) {
            object(item, "content.items", Set.of("id", "name", "spec", "qty", "unitPrice", "note"), Set.of());
            for (String key : new String[]{"id", "name", "spec", "note"}) text(item, key, "content.items");
            if (!ids.add(item.get("id").asText())) invalid("content.items");
            for (String key : new String[]{"qty", "unitPrice"}) {
                JsonNode value = item.get(key);
                long max = key.equals("qty") ? 99999 : 999999999;
                if (!value.isIntegralNumber() || !value.canConvertToLong()
                        || value.longValue() < 0 || value.longValue() > max) invalid("content.items");
            }
        }
        return new InvoiceWrite(title, c, request.get("paid").booleanValue());
    }
}
