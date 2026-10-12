package com.resumecraft.auth;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Signup wire input; password confirmation belongs exclusively to the UI. */
public record SignupRequest(
    @NotNull @Pattern(regexp = "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$") String email,
    @NotNull @Size(min = 2, max = 12) String nickname,
    @NotNull @Size(min = 8) String password
) {
}
