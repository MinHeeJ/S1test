package com.resumecraft.invoices;

import com.fasterxml.jackson.databind.JsonNode;

/** Validated update-only snapshot; server-owned identity and totals cannot enter this payload. */
public record InvoiceWrite(String title, JsonNode content, Boolean paid) {}
