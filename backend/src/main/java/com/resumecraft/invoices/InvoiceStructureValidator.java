package com.resumecraft.invoices;

import com.fasterxml.jackson.databind.JsonNode;
import com.resumecraft.common.DomainException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/** Invoice-local strict schema; PDF requirements and business-number warnings never block draft saves. */
@Component
public class InvoiceStructureValidator {
    public String create(JsonNode body) {
        object(body, "", "docType", "docType");
        allowed(body.path("docType"), "docType", Set.of("quote", "invoice"));
        return body.get("docType").asText();
    }

    public InvoiceWrite write(JsonNode body, String type) {
        object(body, "", "title content paid", "title content paid");
        text(body.get("title"), "title");
        String title = body.get("title").textValue();
        if (title.codePoints().allMatch(c -> Character.isWhitespace(c) || Character.isSpaceChar(c))) invalid("title");
        if (!body.path("paid").isBoolean()) invalid("paid");
        if ("quote".equals(type) && body.get("paid").booleanValue()) invalid("paid");
        JsonNode c = body.get("content");
        object(c, "content", "supplier client issueDate items vatMode notes stampPhotoId color",
                "supplier client issueDate validUntil dueDate items vatMode notes bankAccount stampPhotoId color");
        if (c.toString().getBytes(StandardCharsets.UTF_8).length > 200000) {
            throw new DomainException(HttpStatus.PAYLOAD_TOO_LARGE,
                    "CONTENT_TOO_LARGE", "본문은 200KB 이하로 저장해 주세요.", "content");
        }
        strings(c.get("supplier"), "content.supplier", "name bizNo ceo address phone");
        strings(c.get("client"), "content.client", "name contact");
        for (String key : new String[]{"issueDate", "validUntil", "dueDate"}) {
            if (!c.has(key)) continue;
            text(c.get(key), "content." + key);
            if (!c.get(key).asText().matches("(?:\\d{4}-\\d{2}-\\d{2})?")) invalid("content." + key);
        }
        text(c.get("notes"), "content.notes");
        if (c.has("bankAccount")) text(c.get("bankAccount"), "content.bankAccount");
        allowed(c.get("vatMode"), "content.vatMode", Set.of("separate", "included", "exempt"));
        allowed(c.get("color"), "content.color", Set.of(
                "#1F3A5F", "#2563EB", "#0F766E", "#9F1239", "#C2410C", "#374151"));
        JsonNode stamp = c.get("stampPhotoId");
        if (!stamp.isNull()) {
            text(stamp, "content.stampPhotoId");
            try {
                if (!UUID.fromString(stamp.asText()).toString().equalsIgnoreCase(stamp.asText())) {
                    invalid("content.stampPhotoId");
                }
            } catch (IllegalArgumentException error) {
                invalid("content.stampPhotoId");
            }
        }
        JsonNode items = c.get("items");
        if (!items.isArray() || items.size() > 50) invalid("content.items");
        Set<String> ids = new HashSet<>();
        for (JsonNode item : items) {
            object(item, "content.items", "id name spec qty unitPrice note", "id name spec qty unitPrice note");
            for (String key : new String[]{"id", "name", "spec", "note"}) text(item.get(key), "content.items");
            if (!ids.add(item.get("id").asText())) invalid("content.items");
            integer(item.get("qty"), 99999);
            integer(item.get("unitPrice"), 999999999);
        }
        return new InvoiceWrite(title.strip(), c, body.get("paid").booleanValue());
    }

    private void integer(JsonNode n, long max) {
        if (!n.isIntegralNumber() || !n.canConvertToLong() || n.longValue() < 0 || n.longValue() > max) {
            invalid("content.items");
        }
    }

    private void strings(JsonNode node, String path, String fields) {
        object(node, path, fields, fields);
        for (String field : fields.split(" ")) text(node.get(field), path + "." + field);
    }

    private void object(JsonNode node, String path, String required, String allowed) {
        if (node == null || !node.isObject()) invalid(path);
        Set<String> names = new HashSet<>(Arrays.asList(allowed.split(" ")));
        node.fieldNames().forEachRemaining(key -> {
            if (!names.contains(key)) invalid(path.isEmpty() ? key : path + "." + key);
        });
        for (String key : required.split(" ")) {
            if (!node.has(key)) invalid(path.isEmpty() ? key : path + "." + key);
        }
    }

    private void text(JsonNode n, String path) {
        if (n == null || !n.isTextual()) invalid(path);
    }

    private void allowed(JsonNode n, String path, Set<String> values) {
        text(n, path);
        if (!values.contains(n.asText())) invalid(path);
    }

    public static void invalid(String field) {
        throw new DomainException(HttpStatus.BAD_REQUEST, "INVALID_STRUCTURE", "입력 구조를 확인해 주세요.", field);
    }
}
