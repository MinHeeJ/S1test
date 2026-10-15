package com.resumecraft.invoicesops;

/** Minimal persisted source projection; owner/live filtering happens in the mapper. */
public record InvoiceCopyRow(Long id, String docType, String title, String content) {
}
