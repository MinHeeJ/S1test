package com.resumecraft.common;

import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.stereotype.Service;

/** Resolves the deferred security token for the HTML subrequest; never reads or writes domain rows. */
@Service
public class HtmlCsrfService {
    public void resolve(CsrfToken token) {
        token.getToken();
    }
}
