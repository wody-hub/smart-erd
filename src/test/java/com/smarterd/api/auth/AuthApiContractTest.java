package com.smarterd.api.auth;

import static org.assertj.core.api.Assertions.assertThat;

import com.smarterd.api.auth.dto.RefreshRequest;
import jakarta.validation.Validation;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

class AuthApiContractTest {

    @Test
    void healthResponseUsesRecordDtoInsteadOfRawMap() throws Exception {
        final var method = AuthController.class.getDeclaredMethod("health");

        assertThat(method.getGenericReturnType().getTypeName())
            .contains(ResponseEntity.class.getName())
            .doesNotContain(Map.class.getName());
    }

    @Test
    void refreshRequestUsesLocalizedValidationMessageKey() {
        final var validator = Validation.buildDefaultValidatorFactory().getValidator();
        final var request = new RefreshRequest("");

        assertThat(validator.validate(request))
            .extracting((violation) -> violation.getConstraintDescriptor().getAttributes().get("message"))
            .contains("{validation.not-blank.refresh-token}");
    }
}
