package com.smarterd.domain.user.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.smarterd.api.auth.dto.SignupRequest;
import com.smarterd.config.security.AuthSecurityProperties;
import com.smarterd.domain.user.entity.User;
import com.smarterd.domain.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private AuthenticationManager authenticationManager;

    @Mock
    private JwtTokenService jwtTokenService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private AuthSecurityProperties authSecurityProperties;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private LoginRateLimitService loginRateLimitService;

    @InjectMocks
    private AuthService authService;

    @Test
    @DisplayName("signup - 인증 컨텍스트가 없어도 User 감사 작성자를 loginId로 초기화한다")
    void signup_initializesUserAuditActorWithLoginId() {
        // given
        final var request = new SignupRequest("new-user", "plain-pw", "New User");
        when(userRepository.existsByLoginId(request.loginId())).thenReturn(false);
        when(passwordEncoder.encode(request.password())).thenReturn("encoded-pw");
        when(userRepository.save(any(User.class))).thenAnswer((invocation) -> invocation.getArgument(0, User.class));
        when(jwtTokenService.generateAccessToken(request.loginId())).thenReturn("access-token");
        when(jwtTokenService.createRefreshToken(any(User.class))).thenReturn("refresh-token");

        // when
        final var response = authService.signup(request);

        // then
        final var captor = ArgumentCaptor.forClass(User.class);
        org.mockito.Mockito.verify(userRepository).save(captor.capture());
        final var savedUser = captor.getValue();
        assertThat(savedUser.getCreatedBy()).isEqualTo(request.loginId());
        assertThat(savedUser.getUpdatedBy()).isEqualTo(request.loginId());
        assertThat(response.loginId()).isEqualTo(request.loginId());
        assertThat(response.name()).isEqualTo(request.name());
    }
}
