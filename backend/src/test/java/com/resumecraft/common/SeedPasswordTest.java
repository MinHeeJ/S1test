package com.resumecraft.common;

import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import static org.assertj.core.api.Assertions.assertThat;

class SeedPasswordTest {
    @Test
    void demoMigrationContainsThreeUsableBcryptHashesAndNoPlaintextPassword() throws Exception {
        String sql;
        try (var input = new ClassPathResource("db/migration/V2__demo_seed.sql").getInputStream()) {
            sql = new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }
        var hashes = Pattern.compile("\\$2[aby]\\$\\d{2}\\$[./A-Za-z0-9]{53}").matcher(sql);
        var encoder = new BCryptPasswordEncoder();
        int count = 0;
        while (hashes.find()) {
            assertThat(encoder.matches("demo1234", hashes.group())).isTrue();
            count++;
        }
        assertThat(count).isEqualTo(3);
        assertThat(sql).doesNotContain("demo1234");
    }
}
