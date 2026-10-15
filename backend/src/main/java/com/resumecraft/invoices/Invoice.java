package com.resumecraft.invoices;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.annotation.JsonProperty;

/** Public snapshot preserves the approved snake_case metadata and decimal string identities. */
public record Invoice(
        String id, @JsonProperty("user_id") String userId,
        @JsonProperty("doc_type") String docType, @JsonProperty("doc_no") String docNo,
        @JsonProperty("source_quote_id") String sourceQuoteId, String title, JsonNode content,
        @JsonProperty("supply_amount") Long supplyAmount, @JsonProperty("vat_amount") Long vatAmount,
        @JsonProperty("total_amount") Long totalAmount, Boolean paid, Boolean deleted,
        @JsonProperty("created_at") String createdAt, @JsonProperty("updated_at") String updatedAt
) {}
