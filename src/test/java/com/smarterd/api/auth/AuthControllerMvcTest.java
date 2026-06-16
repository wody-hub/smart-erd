package com.smarterd.api.auth;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.smarterd.api.auth.validator.SignupRequestValidator;
import com.smarterd.domain.user.service.AuthService;
import com.smarterd.utils.ClientIpUtils;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
class AuthControllerMvcTest {

    @Mock
    private AuthService authService;

    @Mock
    private ClientIpUtils clientIpUtils;

    @Mock
    private SignupRequestValidator signupRequestValidator;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        this.mockMvc = MockMvcBuilders.standaloneSetup(
            new AuthController(authService, clientIpUtils, signupRequestValidator)
        ).build();
    }

    @Test
    void healthReturnsOk() throws Exception {
        mockMvc.perform(get("/api/auth/health")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ok"));
    }
}
