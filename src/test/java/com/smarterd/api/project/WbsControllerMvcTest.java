package com.smarterd.api.project;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.domain.pm.history.entity.WorkActivityEventType;
import com.smarterd.domain.pm.history.entity.WorkActivitySubjectType;
import com.smarterd.domain.pm.history.entity.WorkTargetType;
import com.smarterd.domain.pm.history.service.WorkItemHistoryService;
import com.smarterd.domain.pm.history.service.WorkItemHistoryService.WorkActivityResult;
import com.smarterd.domain.pm.history.service.WorkItemHistoryService.WorkCommentResult;
import com.smarterd.domain.pm.wbs.entity.WbsDependencyType;
import com.smarterd.domain.pm.wbs.service.WbsDependencyService;
import com.smarterd.domain.pm.wbs.service.WbsDependencyService.WbsDependencyResult;
import com.smarterd.domain.pm.wbs.service.WbsDependencyService.WbsDependencyShiftIssueResult;
import com.smarterd.domain.pm.wbs.service.WbsDependencyService.WbsDependencyShiftItemResult;
import com.smarterd.domain.pm.wbs.service.WbsDependencyService.WbsDependencyShiftResult;
import com.smarterd.domain.pm.wbs.service.WbsDocumentService;
import com.smarterd.domain.pm.wbs.service.WbsDocumentService.DocumentTagResult;
import com.smarterd.domain.pm.wbs.service.WbsDocumentService.LinkedDocumentResult;
import com.smarterd.domain.pm.wbs.service.WbsPlanningService;
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

    @Mock
    private WbsDocumentService wbsDocumentService;

    @Mock
    private WbsDependencyService wbsDependencyService;

    @Mock
    private WorkItemHistoryService workItemHistoryService;

    @Mock
    private WbsPlanningService wbsPlanningService;

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        this.mockMvc = MockMvcBuilders.standaloneSetup(
            new WbsController(wbsService),
            new WbsDependencyController(wbsDependencyService),
            new WbsDocumentController(wbsDocumentService),
            new WbsHistoryController(workItemHistoryService),
            new WbsPlanningController(wbsPlanningService)
        )
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
        ).thenReturn(
            new WbsItemResult(
                101L,
                null,
                "요구사항 분석",
                0,
                1,
                null,
                null,
                LocalDate.parse("2026-04-20"),
                LocalDate.parse("2026-04-30"),
                LocalDate.parse("2026-04-22"),
                LocalDate.parse("2026-04-29"),
                20,
                73,
                -53,
                2,
                -1,
                new BigDecimal("1.50"),
                null,
                null,
                List.of(),
                List.of(),
                Instant.parse("2026-04-14T00:00:00Z"),
                Instant.parse("2026-04-14T00:00:00Z")
            )
        );

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
                                "actualStartDate",
                                "2026-04-22",
                                "actualEndDate",
                                "2026-04-29",
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
            .andExpect(jsonPath("$.name").value("요구사항 분석"))
            .andExpect(jsonPath("$.actualStartDate[0]").value(2026))
            .andExpect(jsonPath("$.actualStartDate[1]").value(4))
            .andExpect(jsonPath("$.actualStartDate[2]").value(22))
            .andExpect(jsonPath("$.actualEndDate[0]").value(2026))
            .andExpect(jsonPath("$.actualEndDate[1]").value(4))
            .andExpect(jsonPath("$.actualEndDate[2]").value(29));
    }

    @Test
    void getDependencies_returnsList() throws Exception {
        when(wbsDependencyService.getDependencies("tester", 1L, 10L)).thenReturn(List.of(sampleDependency(501L)));

        mockMvc
            .perform(
                get("/api/teams/1/projects/10/wbs/dependencies").with((request) -> {
                    request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                    return request;
                })
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].id").value(501))
            .andExpect(jsonPath("$[0].predecessorWbsItemId").value(100))
            .andExpect(jsonPath("$[0].successorWbsItemId").value(101))
            .andExpect(jsonPath("$[0].dependencyType").value("FS"));
    }

    @Test
    void createDependency_returnsCreated() throws Exception {
        when(
            wbsDependencyService.createDependency(
                eq("tester"),
                eq(1L),
                eq(10L),
                any(WbsDependencyService.WbsDependencyCommand.class)
            )
        ).thenReturn(sampleDependency(501L));

        mockMvc
            .perform(
                post("/api/teams/1/projects/10/wbs/dependencies")
                    .with((request) -> {
                        request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                        return request;
                    })
                    .contentType(APPLICATION_JSON)
                    .content(
                        objectMapper.writeValueAsString(
                            java.util.Map.of(
                                "predecessorWbsItemId",
                                100,
                                "successorWbsItemId",
                                101,
                                "dependencyType",
                                "FS"
                            )
                        )
                    )
            )
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").value(501))
            .andExpect(jsonPath("$.dependencyType").value("FS"));
    }

    @Test
    void getTemplates_returnsList() throws Exception {
        when(wbsPlanningService.getTemplates("tester", 1L, 10L)).thenReturn(
            List.of(
                new WbsPlanningService.WbsTemplateSummaryResult(
                    1L,
                    "기본 템플릿",
                    "설명",
                    "루트",
                    3,
                    1,
                    Instant.now(),
                    Instant.now()
                )
            )
        );

        mockMvc
            .perform(
                get("/api/teams/1/projects/10/wbs/templates").with((request) -> {
                    request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                    return request;
                })
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].name").value("기본 템플릿"))
            .andExpect(jsonPath("$[0].itemCount").value(3));
    }

    @Test
    void duplicateSubtree_returnsCreatedTreeAndDependencies() throws Exception {
        when(
            wbsPlanningService.duplicateSubtree(
                eq("tester"),
                eq(1L),
                eq(10L),
                eq(100L),
                any(WbsPlanningService.DuplicateSubtreeCommand.class)
            )
        ).thenReturn(
            new WbsPlanningService.WbsMutationResult(
                301L,
                List.of(sampleResult(301L, null, "복제 루트", 0, 0), sampleResult(302L, 301L, "복제 자식", 1, 0)),
                List.of(sampleDependency(701L))
            )
        );

        mockMvc
            .perform(
                post("/api/teams/1/projects/10/wbs/100/subtree-copies")
                    .with((request) -> {
                        request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                        return request;
                    })
                    .contentType(APPLICATION_JSON)
                    .content(
                        objectMapper.writeValueAsString(
                            java.util.Map.of(
                                "parentId",
                                200,
                                "resetAssignee",
                                true,
                                "resetSchedule",
                                false,
                                "resetProgress",
                                true,
                                "resetMilestone",
                                true,
                                "includeDependencies",
                                true
                            )
                        )
                    )
            )
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.rootItemId").value(301))
            .andExpect(jsonPath("$.items[1].parentId").value(301))
            .andExpect(jsonPath("$.dependencies[0].id").value(701));
    }

    @Test
    void saveTemplate_returnsCreatedTemplateSummary() throws Exception {
        when(
            wbsPlanningService.saveTemplate(
                eq("tester"),
                eq(1L),
                eq(10L),
                any(WbsPlanningService.SaveTemplateCommand.class)
            )
        ).thenReturn(
            new WbsPlanningService.WbsTemplateSummaryResult(
                11L,
                "운영형 wave",
                "반복 업무 골격",
                "운영 루트",
                4,
                2,
                Instant.parse("2026-05-06T00:00:00Z"),
                Instant.parse("2026-05-06T00:00:00Z")
            )
        );

        mockMvc
            .perform(
                post("/api/teams/1/projects/10/wbs/templates")
                    .with((request) -> {
                        request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                        return request;
                    })
                    .contentType(APPLICATION_JSON)
                    .content(
                        objectMapper.writeValueAsString(
                            java.util.Map.of(
                                "sourceWbsItemId",
                                100,
                                "name",
                                "운영형 wave",
                                "description",
                                "반복 업무 골격"
                            )
                        )
                    )
            )
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").value(11))
            .andExpect(jsonPath("$.rootName").value("운영 루트"))
            .andExpect(jsonPath("$.dependencyCount").value(2));
    }

    @Test
    void instantiateTemplate_returnsCreatedTreeAndDependencies() throws Exception {
        when(
            wbsPlanningService.instantiateTemplate(
                eq("tester"),
                eq(1L),
                eq(10L),
                eq(11L),
                any(WbsPlanningService.InstantiateTemplateCommand.class)
            )
        ).thenReturn(
            new WbsPlanningService.WbsMutationResult(
                501L,
                List.of(sampleResult(501L, null, "템플릿 루트", 0, 0)),
                List.of(sampleDependency(801L))
            )
        );

        mockMvc
            .perform(
                post("/api/teams/1/projects/10/wbs/templates/11/instantiations")
                    .with((request) -> {
                        request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                        return request;
                    })
                    .contentType(APPLICATION_JSON)
                    .content(
                        objectMapper.writeValueAsString(
                            java.util.Map.of(
                                "parentId",
                                200,
                                "resetAssignee",
                                true,
                                "resetSchedule",
                                true,
                                "resetProgress",
                                true,
                                "resetMilestone",
                                true,
                                "includeDependencies",
                                true
                            )
                        )
                    )
            )
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.rootItemId").value(501))
            .andExpect(jsonPath("$.items[0].name").value("템플릿 루트"))
            .andExpect(jsonPath("$.dependencies[0].id").value(801));
    }

    @Test
    void bulkCreate_returnsCreated() throws Exception {
        when(
            wbsPlanningService.bulkCreate(
                eq("tester"),
                eq(1L),
                eq(10L),
                any(WbsPlanningService.BulkCreateCommand.class)
            )
        ).thenReturn(
            new WbsPlanningService.BulkCreateResult(
                List.of(
                    new WbsPlanningService.BulkCreateItemResult(
                        "task-api-design",
                        sampleResult(301L, null, "API 설계", 0, 0)
                    )
                )
            )
        );

        mockMvc
            .perform(
                post("/api/teams/1/projects/10/wbs/batches")
                    .with((request) -> {
                        request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                        return request;
                    })
                    .contentType(APPLICATION_JSON)
                    .content(
                        objectMapper.writeValueAsString(
                            java.util.Map.of(
                                "items",
                                List.of(java.util.Map.of("clientKey", "task-api-design", "name", "API 설계"))
                            )
                        )
                    )
            )
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.items[0].clientKey").value("task-api-design"))
            .andExpect(jsonPath("$.items[0].item.id").value(301));
    }

    @Test
    void previewDependencyShift_returnsValidationSummary() throws Exception {
        when(wbsDependencyService.previewShift(eq("tester"), eq(1L), eq(10L), any())).thenReturn(
            new WbsDependencyShiftResult(
                false,
                false,
                List.of(
                    new WbsDependencyShiftItemResult(
                        101L,
                        LocalDate.parse("2026-05-10"),
                        LocalDate.parse("2026-05-14"),
                        LocalDate.parse("2026-05-12"),
                        LocalDate.parse("2026-05-16"),
                        true
                    )
                ),
                List.of(new WbsDependencyShiftIssueResult(102L, "missing-date", "후행 WBS 일정이 비어 있습니다."))
            )
        );

        mockMvc
            .perform(
                post("/api/teams/1/projects/10/wbs/dependency-shift-simulations")
                    .with((request) -> {
                        request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                        return request;
                    })
                    .contentType(APPLICATION_JSON)
                    .content(
                        objectMapper.writeValueAsString(
                            java.util.Map.of(
                                "anchors",
                                List.of(
                                    java.util.Map.of(
                                        "wbsItemId",
                                        101,
                                        "startDate",
                                        "2026-05-12",
                                        "endDate",
                                        "2026-05-16"
                                    )
                                )
                            )
                        )
                    )
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.graphValid").value(false))
            .andExpect(jsonPath("$.updates[0].wbsItemId").value(101))
            .andExpect(jsonPath("$.issues[0].code").value("missing-date"));
    }

    @Test
    void applyDependencyShift_returnsAppliedResult() throws Exception {
        when(wbsDependencyService.applyShift(eq("tester"), eq(1L), eq(10L), any())).thenReturn(
            new WbsDependencyShiftResult(
                true,
                true,
                List.of(
                    new WbsDependencyShiftItemResult(
                        101L,
                        LocalDate.parse("2026-05-10"),
                        LocalDate.parse("2026-05-14"),
                        LocalDate.parse("2026-05-12"),
                        LocalDate.parse("2026-05-16"),
                        false
                    )
                ),
                List.of()
            )
        );

        mockMvc
            .perform(
                post("/api/teams/1/projects/10/wbs/dependency-shifts")
                    .with((request) -> {
                        request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                        return request;
                    })
                    .contentType(APPLICATION_JSON)
                    .content(
                        objectMapper.writeValueAsString(
                            java.util.Map.of(
                                "anchors",
                                List.of(
                                    java.util.Map.of(
                                        "wbsItemId",
                                        100,
                                        "startDate",
                                        "2026-05-12",
                                        "endDate",
                                        "2026-05-16"
                                    )
                                )
                            )
                        )
                    )
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.graphValid").value(true))
            .andExpect(jsonPath("$.applied").value(true))
            .andExpect(jsonPath("$.updates[0].anchor").value(false))
            .andExpect(jsonPath("$.issues").isEmpty());
    }

    @Test
    void deleteDependency_returnsNoContent() throws Exception {
        mockMvc
            .perform(
                delete("/api/teams/1/projects/10/wbs/dependencies/501").with((request) -> {
                    request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                    return request;
                })
            )
            .andExpect(status().isNoContent());

        verify(wbsDependencyService).deleteDependency("tester", 1L, 10L, 501L);
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
                patch("/api/teams/1/projects/10/wbs/order")
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

    @Test
    void getLinkedDocuments_returnsList() throws Exception {
        when(wbsDocumentService.getLinkedDocuments("tester", 1L, 10L, 100L)).thenReturn(List.of(sampleDocument(42L)));

        mockMvc
            .perform(
                get("/api/teams/1/projects/10/wbs/100/documents").with((request) -> {
                    request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                    return request;
                })
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].id").value(42))
            .andExpect(jsonPath("$[0].tags[0]").value("spec"));
    }

    @Test
    void linkDocument_returnsDocument() throws Exception {
        when(wbsDocumentService.linkDocument("tester", 1L, 10L, 100L, 42L)).thenReturn(sampleDocument(42L));

        mockMvc
            .perform(
                put("/api/teams/1/projects/10/wbs/100/documents/42").with((request) -> {
                    request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                    return request;
                })
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("API Spec"));
    }

    @Test
    void getDocumentTags_returnsTagCounts() throws Exception {
        when(wbsDocumentService.getDocumentTags("tester", 1L, 10L)).thenReturn(
            List.of(new DocumentTagResult("spec", 2))
        );

        mockMvc
            .perform(
                get("/api/teams/1/projects/10/wbs/document-tags").with((request) -> {
                    request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                    return request;
                })
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].tag").value("spec"))
            .andExpect(jsonPath("$[0].documentCount").value(2));
    }

    @Test
    void getDocumentsByTag_returnsDocuments() throws Exception {
        when(wbsDocumentService.getDocumentsByTag("tester", 1L, 10L, "spec")).thenReturn(List.of(sampleDocument(42L)));

        mockMvc
            .perform(
                get("/api/teams/1/projects/10/wbs/document-tags/documents")
                    .queryParam("tag", "spec")
                    .with((request) -> {
                        request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                        return request;
                    })
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].id").value(42));
    }

    @Test
    void getWbsComments_returnsList() throws Exception {
        when(workItemHistoryService.getWbsComments("tester", 1L, 10L, 100L)).thenReturn(List.of(sampleComment(301L)));

        mockMvc
            .perform(
                get("/api/teams/1/projects/10/wbs/100/comments").with((request) -> {
                    request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                    return request;
                })
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].id").value(301))
            .andExpect(jsonPath("$[0].content").value("첫 댓글"))
            .andExpect(jsonPath("$[0].actorName").value("김개발"));
    }

    @Test
    void addWbsComment_returnsCreated() throws Exception {
        when(workItemHistoryService.addWbsComment("tester", 1L, 10L, 100L, "첫 댓글")).thenReturn(sampleComment(301L));

        mockMvc
            .perform(
                post("/api/teams/1/projects/10/wbs/100/comments")
                    .with((request) -> {
                        request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                        return request;
                    })
                    .contentType(APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(java.util.Map.of("content", "첫 댓글")))
            )
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").value(301))
            .andExpect(jsonPath("$.content").value("첫 댓글"));
    }

    @Test
    void getWbsActivities_returnsList() throws Exception {
        when(workItemHistoryService.getWbsActivities("tester", 1L, 10L, 100L)).thenReturn(
            List.of(sampleActivity(401L))
        );

        mockMvc
            .perform(
                get("/api/teams/1/projects/10/wbs/100/activities").with((request) -> {
                    request.setAttribute(TEST_JWT_REQUEST_ATTRIBUTE, jwt("tester"));
                    return request;
                })
            )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].id").value(401))
            .andExpect(jsonPath("$[0].eventType").value("DOCUMENT_LINKED"))
            .andExpect(jsonPath("$[0].subjectLabel").value("API Spec"));
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
            null,
            null,
            0,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            List.of(),
            List.of(),
            Instant.parse("2026-04-14T00:00:00Z"),
            Instant.parse("2026-04-14T00:00:00Z")
        );
    }

    private WbsDependencyResult sampleDependency(Long id) {
        return new WbsDependencyResult(
            id,
            100L,
            "요구사항 분석",
            101L,
            "화면 설계",
            WbsDependencyType.FS,
            0,
            Instant.parse("2026-04-28T00:00:00Z"),
            Instant.parse("2026-04-28T00:00:00Z")
        );
    }

    private LinkedDocumentResult sampleDocument(Long id) {
        return new LinkedDocumentResult(
            id,
            "API Spec",
            "markdown",
            "technical-spec",
            "Technical Spec",
            "Describe the goal and scope.",
            List.of("spec"),
            Instant.parse("2026-04-28T01:00:00Z"),
            Instant.parse("2026-04-28T00:00:00Z"),
            Instant.parse("2026-04-28T01:30:00Z")
        );
    }

    private WorkCommentResult sampleComment(Long id) {
        return new WorkCommentResult(
            id,
            WorkTargetType.WBS,
            100L,
            "첫 댓글",
            "kim",
            "김개발",
            Instant.parse("2026-04-28T01:00:00Z"),
            Instant.parse("2026-04-28T01:00:00Z")
        );
    }

    private WorkActivityResult sampleActivity(Long id) {
        return new WorkActivityResult(
            id,
            WorkTargetType.WBS,
            100L,
            WorkActivityEventType.DOCUMENT_LINKED,
            WorkActivitySubjectType.DOCUMENT,
            42L,
            "API Spec",
            null,
            null,
            "Linked document to WBS item",
            "kim",
            "김개발",
            Instant.parse("2026-04-28T01:10:00Z")
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
