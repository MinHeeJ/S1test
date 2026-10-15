package com.resumecraft.invoices;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.LocalDate;
import java.util.UUID;

/** Only supplier and stamp are inherited; all other defaults are domain defaults, not demo data. */
public final class InvoiceDefaults {
    private InvoiceDefaults() {}

    public static ObjectNode content(ObjectMapper json, String type, LocalDate today, JsonNode recent) {
        ObjectNode result = json.createObjectNode();
        ObjectNode supplier = result.putObject("supplier");
        for (String key : new String[]{"name", "bizNo", "ceo", "address", "phone"}) supplier.put(key, "");
        result.putObject("client").put("name", "").put("contact", "");
        result.put("issueDate", today.toString());
        if ("quote".equals(type)) result.put("validUntil", "");
        else result.put("dueDate", "").put("bankAccount", "");
        result.putArray("items").addObject().put("id", UUID.randomUUID().toString())
                .put("name", "").put("spec", "").put("qty", 0).put("unitPrice", 0).put("note", "");
        result.put("vatMode", "separate").put("notes", "").putNull("stampPhotoId").put("color", "#1F3A5F");
        if (recent != null) {
            result.set("supplier", recent.path("supplier").deepCopy());
            result.set("stampPhotoId", recent.path("stampPhotoId").deepCopy());
        }
        return result;
    }
}
