package com.resumecraft.invoices;

import com.fasterxml.jackson.databind.JsonNode;
import com.resumecraft.common.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** Authenticated invoice CRUD; strict request inspection is local to this feature. */
@RestController
@RequestMapping("/api/invoices")
public class InvoiceController {
    private final InvoiceService service;

    public InvoiceController(InvoiceService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<InvoicePage> listInvoices(Authentication actor,
            @RequestParam(required = false) String type, @RequestParam(required = false) String page,
            @RequestParam(required = false) String size) {
        return ApiResponse.ok(service.list(actor, type, page, size));
    }

    @GetMapping("/{id}")
    public ApiResponse<Invoice> getInvoice(Authentication actor, @PathVariable String id) {
        return ApiResponse.ok(service.get(actor, id));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<CreatedInvoice>> createInvoice(
            Authentication actor, @RequestBody JsonNode request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok(service.create(actor, request)));
    }

    @PutMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void saveInvoice(Authentication actor, @PathVariable String id, @RequestBody JsonNode request) {
        service.save(actor, id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteInvoice(Authentication actor, @PathVariable String id) {
        service.delete(actor, id);
    }
}
