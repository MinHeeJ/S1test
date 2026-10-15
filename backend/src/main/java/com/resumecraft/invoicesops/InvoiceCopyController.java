package com.resumecraft.invoicesops;

import com.resumecraft.common.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Session/CSRF-protected copy commands; source IDs never confer ownership. */
@RestController
@RequestMapping("/api/invoices")
public class InvoiceCopyController {
    private final InvoiceCopyService service;

    public InvoiceCopyController(InvoiceCopyService service) {
        this.service = service;
    }

    /** Returns only the generated key; the regular detail API exposes the persisted snapshot. */
    @PostMapping("/{id}/duplicate")
    public ResponseEntity<ApiResponse<CreatedInvoiceCopy>> duplicateInvoice(
            Authentication actor, @PathVariable String id
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(service.duplicate(actor, id)));
    }

    /** Conversion is quote-only and creates a new invoice without mutating its source. */
    @PostMapping("/{id}/convert")
    public ResponseEntity<ApiResponse<CreatedInvoiceCopy>> createInvoiceFromQuote(
            Authentication actor, @PathVariable String id
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(service.convert(actor, id)));
    }
}
