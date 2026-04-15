package com.smarterd.api.project;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.domain.pm.wbs.service.WbsService;
import com.smarterd.domain.pm.wbs.service.WbsService.WbsItemResult;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
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
class WbsControllerMvcTest {

    private static final String TEST_JWT_REQUEST_ATTRIBUTE = "test.jwt.principal";

    @Mock
    private WbsService wbsService;

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        final var controller = new WbsController(wbsService);
        this.mockMvc = MockMvcBuilders.standaloneSetup(controller)
            .setCustomArgumentResolvers(new TestJwtArgumentResolver())
            .build();
        this.objectMapper = new ObjectMapper();
    }

    @Test
    void getWbsItems_returnsList() throws Exception {
        when(wbsService.getWbsItems("tester", 1L, 10L)).thenReturn(List.of(sampleResult(100L, null, "루트", 0, 0)));

        mockMvc
            .perform(
                get("/api/teams/1/projects/10/wbs").with((request) -> {
                    request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                    return request;
                })
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].id").value(100))
            .andExpect(jsonPath("$[0].name").value("루트"))
            .andExpect(jsonPath("$[0].depth").value(0));
    }

    @Test
    void createWbsItem_returnsCreated() throws Exception {
        when(
            wbsService.createWbsItem(eq("tester"), eq(1L), eq(10L), any(WbsService.CreateWbsItemCommand.class))
        ).thenReturn(sampleResult(101L, null, "요구사항 분석", 0, 1));

        mockMvc
            .perform(
                post("/api/teams/1/projects/10/wbs")
                    .with((request) -> {
                        request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                        return request;
                    })
                    .contentType(APPLICATION_JSON)
                    .content(
                        objectMapper.writeValueAsString(
                            java.util.Map.of(
                                "name",
                                "요구사항 분석",
                                "startDate",
                                "2026-04-20",
                                "endDate",
                                "2026-04-30",
                                "progressRate",
                                20,
                                "estimatedMm",
                                "1.50"
                            )
                        )
                    )
            )
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").value(101))
            .andExpect(jsonPath("$.name").value("요구사항 분석"));
    }

    @Test
    void reorderWbsItems_callsServiceAndReturnsUpdatedList() throws Exception {
        when(
            wbsService.reorderWbsItems(
                eq("tester"),
                eq(1L),
                eq(10L),
                eq(List.of(new WbsService.WbsReorderCommand(100L, null, 0)))
            )
        ).thenReturn(List.of(sampleResult(100L, null, "루트", 0, 0)));

        mockMvc
            .perform(
                patch("/api/teams/1/projects/10/wbs/reorder")
                    .with((request) -> {
                        request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                        return request;
                    })
                    .contentType(APPLICATION_JSON)
                    .content(
                        objectMapper.writeValueAsString(
                            java.util.Map.of("items", List.of(java.util.Map.of("id", 100, "sortOrder", 0)))
                        )
                    )
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].id").value(100));

        verify(wbsService).reorderWbsItems(
            eq("tester"),
            eq(1L),
            eq(10L),
            eq(List.of(new WbsService.WbsReorderCommand(100L, null, 0)))
        );
    }

    private WbsItemResult sampleResult(Long id, Long parentId, String name, int depth, int sortOrder) {
        return new WbsItemResult(
            id,
            parentId,
            name,
            depth,
            sortOrder,
            null,
            null,
            null,
            null,
            0,
            null,
            null,
            null,
            Instant.parse("2026-04-14T00:00:00Z"),
            Instant.parse("2026-04-14T00:00:00Z")
        );
    }

    private Jwt jwt(String subject) {
        return Jwt.withTokenValue("token").header("alg", "none").subject(subject).build();
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
