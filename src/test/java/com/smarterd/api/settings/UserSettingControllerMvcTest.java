package com.smarterd.api.settings;

import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.domain.settings.service.UserSettingService;
import com.smarterd.domain.settings.service.UserSettingService.ProjectWorkspaceTabOrderResult;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.MethodParameter;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

@ExtendWith(MockitoExtension.class)
class UserSettingControllerMvcTest {

    private static final String TEST_JWT_REQUEST_ATTRIBUTE = "test.jwt.principal";

    @Mock
    private UserSettingService userSettingService;

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        this.mockMvc = MockMvcBuilders.standaloneSetup(new UserSettingController(userSettingService))
            .setCustomArgumentResolvers(new TestJwtArgumentResolver())
            .build();
        this.objectMapper = new ObjectMapper();
    }

    @Test
    void getProjectWorkspaceTabOrder_returnsStoredOrder() throws Exception {
        when(userSettingService.getProjectWorkspaceTabOrder("tester")).thenReturn(
            new ProjectWorkspaceTabOrderResult(List.of("documents", "overview", "tags"))
        );

        mockMvc
            .perform(
                get("/api/settings/project-workspace-tabs").with((request) -> {
                    request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                    return request;
                })
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.tabOrder[0]").value("documents"))
            .andExpect(jsonPath("$.tabOrder[1]").value("overview"))
            .andExpect(jsonPath("$.tabOrder[2]").value("tags"));
    }

    @Test
    void updateProjectWorkspaceTabOrder_returnsNormalizedOrder() throws Exception {
        when(userSettingService.updateProjectWorkspaceTabOrder("tester", List.of("documents", "issues"))).thenReturn(
            new ProjectWorkspaceTabOrderResult(
                List.of("documents", "issues", "overview", "tags", "wbs", "myTasks", "gantt", "staffing")
            )
        );

        mockMvc
            .perform(
                put("/api/settings/project-workspace-tabs")
                    .with((request) -> {
                        request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                        return request;
                    })
                    .contentType(APPLICATION_JSON)
                    .content(
                        objectMapper.writeValueAsString(java.util.Map.of("tabOrder", List.of("documents", "issues")))
                    )
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.tabOrder[0]").value("documents"))
            .andExpect(jsonPath("$.tabOrder[1]").value("issues"))
            .andExpect(jsonPath("$.tabOrder[7]").value("staffing"));
    }

    private Jwt jwt(String subject) {
        return Jwt.withTokenValue("token").header("alg", "none").subject(subject).claim("sub", subject).build();
    }

    private static final class TestJwtArgumentResolver implements HandlerMethodArgumentResolver {

        @Override
        public boolean supportsParameter(MethodParameter parameter) {
            return (
                parameter.hasParameterAnnotation(AuthenticationPrincipal.class) &&
                Jwt.class.isAssignableFrom(parameter.getParameterType())
            );
        }

        @Override
        public Object resolveArgument(
            MethodParameter parameter,
            ModelAndViewContainer mavContainer,
            NativeWebRequest webRequest,
            WebDataBinderFactory binderFactory
        ) {
            return webRequest
                .getNativeRequest(jakarta.servlet.http.HttpServletRequest.class)
                .getAttribute(TEST_JWT_REQUEST_ATTRIBUTE);
        }
    }
}
