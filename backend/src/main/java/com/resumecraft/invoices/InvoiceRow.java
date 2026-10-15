package com.resumecraft.invoices;

import java.time.OffsetDateTime;

/** Exact PostgreSQL projection, including nullable source and boxed BIGINT values. */
public record InvoiceRow(
        Long id, Long userId, String docType, String docNo, Long sourceQuoteId,
        String title, String content, Long supplyAmount, Long vatAmount, Long totalAmount,
        Boolean paid, Boolean deleted, OffsetDateTime createdAt, OffsetDateTime updatedAt
) {}
