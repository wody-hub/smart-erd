package com.smarterd.domain.pm.wbs.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.domain.common.exception.EntityNotFoundException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.pm.common.ProjectContextLoader;
import com.smarterd.domain.pm.milestone.repository.MilestoneRepository;
import com.smarterd.domain.pm.wbs.entity.WbsTemplate;
import com.smarterd.domain.pm.wbs.repository.WbsDependencyRepository;
import com.smarterd.domain.pm.wbs.repository.WbsItemRepository;
import com.smarterd.domain.pm.wbs.repository.WbsTemplateRepository;
import com.smarterd.domain.team.repository.TeamMemberRepository;
import com.smarterd.domain.user.repository.UserRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * WBS planning 2차 기능(복제/템플릿/대량생성)을 제공한다.
 */
@Service
@Transactional(readOnly = true)
public class WbsPlanningService {

    private final WbsTemplateRepository wbsTemplateRepository;
    private final ProjectContextLoader projectContextLoader;
    private final WbsPlanningSnapshotSupport snapshotSupport;
    private final WbsPlanningInstantiationSupport instantiationSupport;
    private final WbsPlanningBulkCreateSupport bulkCreateSupport;
    private final WbsPlanningPayloadJsonSupport payloadJsonSupport;
    private final WbsPlanningResultMapper resultMapper;

    /**
     * @param wbsItemRepository WBS item 레포지토리
     * @param wbsDependencyRepository WBS dependency 레포지토리
     * @param wbsTemplateRepository WBS template 레포지토리
     * @param milestoneRepository 마일스톤 레포지토리
     * @param projectContextLoader 프로젝트 컨텍스트 로더
     * @param teamMemberRepository 팀 멤버 레포지토리
     * @param userRepository 사용자 레포지토리
     * @param objectMapper JSON object mapper
     * @param wbsScheduleMetricsService WBS 일정 지표 서비스
     */
    public WbsPlanningService(
        WbsItemRepository wbsItemRepository,
        WbsDependencyRepository wbsDependencyRepository,
        WbsTemplateRepository wbsTemplateRepository,
        MilestoneRepository milestoneRepository,
        ProjectContextLoader projectContextLoader,
        TeamMemberRepository teamMemberRepository,
        UserRepository userRepository,
        ObjectMapper objectMapper,
        WbsScheduleMetricsService wbsScheduleMetricsService
    ) {
        this.wbsTemplateRepository = wbsTemplateRepository;
        this.projectContextLoader = projectContextLoader;
        this.resultMapper = new WbsPlanningResultMapper(wbsScheduleMetricsService);
        final var itemFactory = new WbsPlanningItemFactory(
            wbsItemRepository,
            milestoneRepository,
            teamMemberRepository,
            userRepository
        );
        this.snapshotSupport = new WbsPlanningSnapshotSupport(wbsItemRepository, wbsDependencyRepository);
        this.instantiationSupport = new WbsPlanningInstantiationSupport(
            wbsDependencyRepository,
            itemFactory,
            resultMapper
        );
        this.bulkCreateSupport = new WbsPlanningBulkCreateSupport(itemFactory, resultMapper);
        this.payloadJsonSupport = new WbsPlanningPayloadJsonSupport(objectMapper);
    }

    /**
     * 프로젝트 WBS template 목록을 조회한다.
     *
     * @param loginId 로그인 ID
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @return WBS template 요약 목록
     */
    public List<WbsTemplateSummaryResult> getTemplates(String loginId, Long teamId, Long projectId) {
        final var context = projectContextLoader.load(loginId, teamId, projectId, false);
        return wbsTemplateRepository
            .findByProjectOrderByUpdatedAtDescIdDesc(context.project())
            .stream()
            .map(resultMapper::toTemplateSummary)
            .toList();
    }

    /**
     * WBS subtree를 복제한다.
     *
     * @param loginId 로그인 ID
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @param sourceWbsItemId 복제할 원본 WBS item ID
     * @param command 복제 명령
     * @return mutation 결과
     */
    @Transactional
    public WbsMutationResult duplicateSubtree(
        String loginId,
        Long teamId,
        Long projectId,
        Long sourceWbsItemId,
        DuplicateSubtreeCommand command
    ) {
        final var context = projectContextLoader.load(loginId, teamId, projectId, true);
        final var snapshot = snapshotSupport.snapshotSubtree(context.project(), sourceWbsItemId);
        return instantiationSupport.instantiateSnapshot(
            context.team(),
            context.project(),
            snapshot,
            command.toInstantiationCommand()
        );
    }

    /**
     * WBS subtree를 template으로 저장한다.
     *
     * @param loginId 로그인 ID
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @param command template 저장 명령
     * @return 저장된 template 요약
     */
    @Transactional
    public WbsTemplateSummaryResult saveTemplate(
        String loginId,
        Long teamId,
        Long projectId,
        SaveTemplateCommand command
    ) {
        final var context = projectContextLoader.load(loginId, teamId, projectId, true);
        final var payload = snapshotSupport.snapshotSubtree(context.project(), command.sourceWbsItemId());
        final var template = WbsTemplate.builder()
            .project(context.project())
            .name(command.name())
            .description(command.description())
            .rootName(payload.rootName())
            .itemCount(payload.nodes().size())
            .dependencyCount(payload.dependencies().size())
            .payloadJson(payloadJsonSupport.serializePayload(payload))
            .build();
        wbsTemplateRepository.save(template);
        return resultMapper.toTemplateSummary(template);
    }

    /**
     * 저장된 WBS template을 프로젝트 WBS에 적용한다.
     *
     * @param loginId 로그인 ID
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @param templateId template ID
     * @param command template 적용 명령
     * @return mutation 결과
     */
    @Transactional
    public WbsMutationResult instantiateTemplate(
        String loginId,
        Long teamId,
        Long projectId,
        Long templateId,
        InstantiateTemplateCommand command
    ) {
        final var context = projectContextLoader.load(loginId, teamId, projectId, true);
        final var template = wbsTemplateRepository
            .findByProjectAndId(context.project(), templateId)
            .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_WBS_ITEM.code(), templateId));
        final var payload = payloadJsonSupport.deserializePayload(template.getPayloadJson());
        return instantiationSupport.instantiateSnapshot(context.team(), context.project(), payload, command);
    }

    /**
     * WBS item을 대량 생성한다.
     *
     * @param loginId 로그인 ID
     * @param teamId 팀 ID
     * @param projectId 프로젝트 ID
     * @param command 대량 생성 명령
     * @return 대량 생성 결과
     */
    @Transactional
    public BulkCreateResult bulkCreate(String loginId, Long teamId, Long projectId, BulkCreateCommand command) {
        final var context = projectContextLoader.load(loginId, teamId, projectId, true);
        return bulkCreateSupport.bulkCreate(context.team(), context.project(), command);
    }

    public record DuplicateSubtreeCommand(
        @Nullable Long parentId,
        boolean resetAssignee,
        boolean resetSchedule,
        boolean resetProgress,
        boolean resetMilestone,
        boolean includeDependencies
    ) {
        public InstantiateTemplateCommand toInstantiationCommand() {
            return new InstantiateTemplateCommand(
                parentId,
                resetAssignee,
                resetSchedule,
                resetProgress,
                resetMilestone,
                includeDependencies
            );
        }
    }

    public record SaveTemplateCommand(Long sourceWbsItemId, String name, @Nullable String description) {}

    public record InstantiateTemplateCommand(
        @Nullable Long parentId,
        boolean resetAssignee,
        boolean resetSchedule,
        boolean resetProgress,
        boolean resetMilestone,
        boolean includeDependencies
    ) {}

    public record BulkCreateCommand(List<BulkCreateItemCommand> items) {}

    public record BulkCreateItemCommand(
        String clientKey,
        @Nullable Long parentId,
        @Nullable String parentClientKey,
        String name,
        @Nullable Long assigneeUserId,
        @Nullable LocalDate startDate,
        @Nullable LocalDate endDate,
        @Nullable Integer progressRate,
        @Nullable BigDecimal estimatedMm,
        @Nullable Long milestoneId
    ) {}

    public record BulkCreateResult(List<BulkCreateItemResult> items) {}

    public record BulkCreateItemResult(String clientKey, WbsService.WbsItemResult item) {}

    public record WbsMutationResult(
        Long rootItemId,
        List<WbsService.WbsItemResult> items,
        List<WbsDependencyService.WbsDependencyResult> dependencies
    ) {}

    public record WbsTemplateSummaryResult(
        Long id,
        String name,
        @Nullable String description,
        String rootName,
        int itemCount,
        int dependencyCount,
        Instant createdAt,
        Instant updatedAt
    ) {}

    record TemplatePayload(
        String rootName,
        List<TemplateNodePayload> nodes,
        List<TemplateDependencyPayload> dependencies
    ) {}

    record TemplateNodePayload(
        String stableKey,
        @Nullable String parentStableKey,
        String name,
        @Nullable Long assigneeUserId,
        @Nullable LocalDate startDate,
        @Nullable LocalDate endDate,
        int progressRate,
        @Nullable BigDecimal estimatedMm,
        @Nullable Long milestoneId,
        int order
    ) {}

    record TemplateDependencyPayload(
        String predecessorStableKey,
        String successorStableKey,
        com.smarterd.domain.pm.wbs.entity.WbsDependencyType dependencyType
    ) {}
}
