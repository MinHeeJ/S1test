package com.resumecraft.invoices;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;

/** Creation defaults copy only supplier and stamp from the latest live document of either kind. */
public final class InvoiceDefaults {
    private InvoiceDefaults() {}

    public static ObjectNode content(ObjectMapper json, String type, InvoiceRow latest) {
        ObjectNode c = json.createObjectNode();
        ObjectNode supplier = c.putObject("supplier");
        for (String key : new String[]{"name", "bizNo", "ceo", "address", "phone"}) supplier.put(key, "");
        c.putObject("client").put("name", "").put("contact", "");
        c.put("issueDate", LocalDate.now(ZoneId.of("Asia/Seoul")).toString());
        if (type.equals("quote")) c.put("validUntil", "");
        else c.put("dueDate", "").put("bankAccount", "");
        c.putArray("items").addObject().put("id", UUID.randomUUID().toString())
                .put("name", "").put("spec", "").put("qty", 0).put("unitPrice", 0).put("note", "");
        c.put("vatMode", "separate").put("notes", "").put("color", "#1F3A5F").putNull("stampPhotoId");
        if (latest != null) {
            try {
                var previous = json.readTree(latest.content());
                c.set("supplier", previous.get("supplier").deepCopy());
                c.set("stampPhotoId", previous.get("stampPhotoId").deepCopy());
            } catch (Exception e) { throw new IllegalStateException("저장 자료를 읽지 못했습니다."); }
        }
        return c;
    }
}
