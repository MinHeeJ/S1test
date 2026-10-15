package com.resumecraft.invoices;

import java.util.List;

/** Bounded, owner-scoped result with the same filter applied to items and count. */
public record InvoicePage(List<Invoice> items, int page, int size, long total) {}
