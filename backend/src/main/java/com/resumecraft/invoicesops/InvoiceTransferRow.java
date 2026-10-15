package com.resumecraft.invoicesops;

import java.time.OffsetDateTime;

/** Retained source snapshot; owner and live-state predicates are enforced by the mapper. */
public record InvoiceTransferRow(
        Long id, Long userId, String docType, String docNo, Long sourceQuoteId,
        String title, String content, Long supplyAmount, Long vatAmount, Long totalAmount,
        Boolean paid, Boolean deleted, OffsetDateTime createdAt, OffsetDateTime updatedAt
) {}
