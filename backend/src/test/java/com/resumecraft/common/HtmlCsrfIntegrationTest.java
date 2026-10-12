package com.resumecraft.common;

import com.resumecraft.security.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Public HTML bootstrap exercises the real deferred-token service, without domain persistence. */
@WebMvcTest(HtmlCsrfController.class)
@Import({SecurityConfig.class, HtmlCsrfService.class})
class HtmlCsrfIntegrationTest {
    @Autowired
    MockMvc mvc;

    @Test
    void rootResolvesDeferredCsrfCookieWithoutResponseBody() throws Exception {
        var response = mvc.perform(get("/"))
            .andExpect(status().isNoContent())
            .andExpect(content().string(""))
            .andReturn().getResponse();
        var cookie = response.getCookie("XSRF-TOKEN");
        assertThat(cookie).isNotNull();
        assertThat(cookie.getValue()).isNotBlank();
        assertThat(cookie.getPath()).isEqualTo("/");
        assertThat(cookie.isHttpOnly()).isFalse();
    }

    @Test
    void indexHtmlResolvesAndReusesExistingCsrfCookieWithoutResponseBody() throws Exception {
        var response = mvc.perform(get("/index.html"))
            .andExpect(status().isNoContent())
            .andExpect(content().string(""))
            .andReturn().getResponse();
        var cookie = response.getCookie("XSRF-TOKEN");
        assertThat(cookie).isNotNull();
        assertThat(cookie.getValue()).isNotBlank();
        assertThat(cookie.getPath()).isEqualTo("/");
        mvc.perform(get("/index.html").cookie(cookie))
            .andExpect(status().isNoContent())
            .andExpect(content().string(""))
            .andExpect(result -> assertThat(result.getResponse().getCookie("XSRF-TOKEN")).isNull());
    }
}
