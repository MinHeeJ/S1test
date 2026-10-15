package com.resumecraft.invoicesops;

/** Values for one new snapshot; paid and deleted always use their false database defaults. */
public record InvoiceTransferInsert(
        Long userId, String docType, String docNo, Long sourceQuoteId, String title,
        String content, Long supplyAmount, Long vatAmount, Long totalAmount
) {}
