package com.resumecraft.invoices;

import java.util.List;

/** Fixed-size, owner-scoped page, with the same predicates in items and total. */
public record InvoicePage(List<Invoice> items, int page, int size, long total) {}
