package com.smarterd.api.diagram;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.application.diagram.command.PersistDiagramSnapshotUseCase;
import com.smarterd.application.diagram.command.SaveDiagramUseCase;
import com.smarterd.domain.diagram.service.DiagramService;
import com.smarterd.domain.diagram.service.DiagramService.SaveDiagramResult;
import java.time.Instant;
import java.util.Base64;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.MethodParameter;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
class DiagramControllerMvcTest {

    private static final String TEST_JWT_REQUEST_ATTRIBUTE = "test.jwt.principal";

    @Mock
    private DiagramService diagramService;

    @Mock
    private SaveDiagramUseCase saveDiagramUseCase;

    @Mock
    private PersistDiagramSnapshotUseCase persistDiagramSnapshotUseCase;

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        final var controller = new DiagramController(diagramService, saveDiagramUseCase, persistDiagramSnapshotUseCase);
        this.mockMvc = MockMvcBuilders.standaloneSetup(controller)
            .setCustomArgumentResolvers(new TestJwtArgumentResolver())
            .build();
        this.objectMapper = new ObjectMapper();
    }

    @Test
    void saveDiagram_bindsBase64SnapshotAndReturnsJsonBody() throws Exception {
        final var snapshot = new byte[] { 0x01, 0x02 };
        final var result = new SaveDiagramResult(17L, true, 17L, Instant.parse("2026-03-23T12:00:00Z"), Instant.parse("2026-03-23T12:00:01Z"));

        when(saveDiagramUseCase.execute(eq("tester"), eq(1L), eq(10L), eq(100L), eq("{\"nodes\":[]}"), any(byte[].class)))
            .thenReturn(result);

        mockMvc.perform(
                put("/api/teams/1/projects/10/diagrams/100")
                    .with(request -> {
                        request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                        return request;
                    })
                    .contentType(APPLICATION_JSON)
                    .content(
                        objectMapper.writeValueAsString(
                            java.util.Map.of(
                                "content",
                                "{\"nodes\":[]}",
                                "ydocSnapshot",
                                Base64.getEncoder().encodeToString(snapshot)
                            )
                        )
                    )
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.contentRevision").value("17"))
            .andExpect(jsonPath("$.hasYdocSnapshot").value(true));

        final var snapshotCaptor = ArgumentCaptor.forClass(byte[].class);
        verify(saveDiagramUseCase).execute(eq("tester"), eq(1L), eq(10L), eq(100L), eq("{\"nodes\":[]}"), snapshotCaptor.capture());
        org.assertj.core.api.Assertions.assertThat(snapshotCaptor.getValue()).isEqualTo(snapshot);
    }

    @Test
    void persistYdocSnapshot_bindsBase64SnapshotAndReturnsPersistedFlag() throws Exception {
        final var snapshot = new byte[] { 0x11 };
        when(persistDiagramSnapshotUseCase.execute(eq("tester"), eq(1L), eq(10L), eq(100L), eq("17"), any(byte[].class)))
            .thenReturn(false);

        mockMvc.perform(
                post("/api/teams/1/projects/10/diagrams/100/ydoc-snapshot")
                    .with(request -> {
                        request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                        return request;
                    })
                    .contentType(APPLICATION_JSON)
                    .content(
                        objectMapper.writeValueAsString(
                            java.util.Map.of(
                                "expectedContentRevision",
                                "17",
                                "ydocSnapshot",
                                Base64.getEncoder().encodeToString(snapshot)
                            )
                        )
                    )
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.persisted").value(false));

        final var snapshotCaptor = ArgumentCaptor.forClass(byte[].class);
        verify(persistDiagramSnapshotUseCase).execute(eq("tester"), eq(1L), eq(10L), eq(100L), eq("17"), snapshotCaptor.capture());
        org.assertj.core.api.Assertions.assertThat(snapshotCaptor.getValue()).isEqualTo(snapshot);
    }

    private Jwt jwt(String subject) {
        return Jwt.withTokenValue("token")
            .header("alg", "none")
            .subject(subject)
            .build();
    }

    /**
     * standalone MockMvc 환경에서 {@link AuthenticationPrincipal} JWT 주입만 흉내내는 테스트용 resolver.
     *
     * <p>이 테스트의 목적은 Spring MVC JSON/base64 바인딩과 응답 직렬화 검증이므로,
     * 보안 필터체인을 올리지 않고 request attribute로 JWT를 주입한다.</p>
     */
    private static final class TestJwtArgumentResolver implements HandlerMethodArgumentResolver {

        @Override
        public boolean supportsParameter(MethodParameter parameter) {
            return parameter.hasParameterAnnotation(AuthenticationPrincipal.class)
                && Jwt.class.isAssignableFrom(parameter.getParameterType());
        }

        @Override
        public Object resolveArgument(
            MethodParameter parameter,
            ModelAndViewContainer mavContainer,
            NativeWebRequest webRequest,
            WebDataBinderFactory binderFactory
        ) {
            return webRequest.getNativeRequest(jakarta.servlet.http.HttpServletRequest.class)
                .getAttribute(TEST_JWT_REQUEST_ATTRIBUTE);
        }
    }
}
