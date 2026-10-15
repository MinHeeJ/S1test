package com.resumecraft.invoicesops;

import com.resumecraft.common.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Bodyless copy commands reuse the application's session, CSRF, safe errors and response envelope. */
@RestController
@RequestMapping("/api/invoices")
public class InvoiceTransferController {
    private final InvoiceTransferService service;

    public InvoiceTransferController(InvoiceTransferService service) {
        this.service = service;
    }

    /** Create a new same-type document without changing the owned source. */
    @PostMapping("/{id}/duplicate")
    public ResponseEntity<ApiResponse<CreatedInvoiceCopy>> duplicateInvoice(
            Authentication actor, @PathVariable String id
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(service.duplicate(actor, id)));
    }

    /** Create a linked unpaid invoice; a non-quote source is a typed 409 conflict. */
    @PostMapping("/{id}/convert")
    public ResponseEntity<ApiResponse<CreatedInvoiceCopy>> createInvoiceFromQuote(
            Authentication actor, @PathVariable String id
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(service.convert(actor, id)));
    }
}
