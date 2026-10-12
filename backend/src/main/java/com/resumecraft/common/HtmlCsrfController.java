package com.resumecraft.common;

import org.springframework.http.ResponseEntity;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Nginx uses this internal HTML subrequest to attach a CSRF cookie to the actual SPA HTML response. */
@RestController
public class HtmlCsrfController {
    private final HtmlCsrfService service;

    public HtmlCsrfController(HtmlCsrfService service) {
        this.service = service;
    }

    @GetMapping("/")
    public ResponseEntity<Void> htmlToken(CsrfToken token) {
        service.resolve(token);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/index.html")
    public ResponseEntity<Void> indexHtmlToken(CsrfToken token) {
        service.resolve(token);
        return ResponseEntity.noContent().build();
    }
}
