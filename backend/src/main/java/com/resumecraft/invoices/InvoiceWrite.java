package com.resumecraft.invoices;

import com.fasterxml.jackson.databind.JsonNode;

/** Validated mutable snapshot; immutable metadata and calculated amounts are excluded. */
public record InvoiceWrite(String title, JsonNode content, boolean paid) {}
