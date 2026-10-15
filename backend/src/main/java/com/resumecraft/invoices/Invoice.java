package com.resumecraft.invoices;

import com.fasterxml.jackson.databind.JsonNode;

/** Public snapshot keeps the approved snake_case metadata and camelCase JSON content. */
public record Invoice(
        String id, String user_id, String doc_type, String doc_no, String source_quote_id,
        String title, JsonNode content, long supply_amount, long vat_amount, long total_amount,
        boolean paid, boolean deleted, String created_at, String updated_at
) {}
