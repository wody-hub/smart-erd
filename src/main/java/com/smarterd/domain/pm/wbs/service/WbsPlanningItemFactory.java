package com.smarterd.domain.pm.wbs.service;

import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.exception.DomainAccessDeniedException;
import com.smarterd.domain.common.exception.EntityNotFoundException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.pm.milestone.entity.Milestone;
import com.smarterd.domain.pm.milestone.repository.MilestoneRepository;
import com.smarterd.domain.pm.wbs.entity.WbsItem;
import com.smarterd.domain.pm.wbs.repository.WbsItemRepository;
import com.smarterd.domain.project.entity.Project;
import com.smarterd.domain.team.entity.Team;
import com.smarterd.domain.team.repository.TeamMemberRepository;
import com.smarterd.domain.user.entity.User;
import com.smarterd.domain.user.repository.UserRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import org.springframework.lang.Nullable;

/**
 * WBS planning 작업에서 WBS item 엔티티 생성을 담당한다.
 */
final class WbsPlanningItemFactory {

    private final WbsItemRepository wbsItemRepository;
    private final MilestoneRepository milestoneRepository;
    private final TeamMemberRepository teamMemberRepository;
    private final UserRepository userRepository;

    /**
     * @param wbsItemRepository WBS item 레포지토리
     * @param milestoneRepository 마일스톤 레포지토리
     * @param teamMemberRepository 팀 멤버 레포지토리
     * @param userRepository 사용자 레포지토리
     */
    WbsPlanningItemFactory(
        WbsItemRepository wbsItemRepository,
        MilestoneRepository milestoneRepository,
        TeamMemberRepository teamMemberRepository,
        UserRepository userRepository
    ) {
        this.wbsItemRepository = wbsItemRepository;
        this.milestoneRepository = milestoneRepository;
        this.teamMemberRepository = teamMemberRepository;
        this.userRepository = userRepository;
    }

    /**
     * WBS item을 생성하고 저장한다.
     *
     * @param team 팀
     * @param project 프로젝트
     * @param parent 부모 WBS
     * @param name WBS 이름
     * @param assigneeUserId 담당자 사용자 ID
     * @param startDate 시작일
     * @param endDate 종료일
     * @param actualStartDate 실제 시작일
     * @param actualEndDate 실제 종료일
     * @param progressRate 진척률
     * @param estimatedMm 예상 MM
     * @param milestoneId 마일스톤 ID
     * @param nextSortOrderByParent parent별 다음 sort order
     * @return 저장된 WBS item
     */
    WbsItem createItem(
        Team team,
        Project project,
        @Nullable WbsItem parent,
        String name,
        @Nullable Long assigneeUserId,
        @Nullable LocalDate startDate,
        @Nullable LocalDate endDate,
        @Nullable LocalDate actualStartDate,
        @Nullable LocalDate actualEndDate,
        @Nullable Integer progressRate,
        @Nullable BigDecimal estimatedMm,
        @Nullable Long milestoneId,
        Map<WbsParentRef, Integer> nextSortOrderByParent
    ) {
        final var depth = parent == null ? 0 : parent.getDepth() + 1;
        if (depth > WbsItem.MAX_DEPTH) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_WBS_DEPTH_LIMIT_EXCEEDED.code());
        }

        final var item = WbsItem.builder()
            .project(project)
            .parent(parent)
            .name(name)
            .depth(depth)
            .sortOrder(nextSortOrder(nextSortOrderByParent, project, parent))
            .assignee(resolveAssignee(team, assigneeUserId))
            .startDate(startDate)
            .endDate(endDate)
            .actualStartDate(actualStartDate)
            .actualEndDate(actualEndDate)
            .progressRate(progressRate == null ? 0 : progressRate)
            .estimatedMm(estimatedMm)
            .milestone(resolveMilestone(project, milestoneId))
            .build();
        return wbsItemRepository.save(item);
    }

    /**
     * 부모 WBS를 조회한다.
     *
     * @param project 프로젝트
     * @param parentId 부모 WBS ID
     * @return 부모 WBS
     */
    @Nullable
    WbsItem resolveParent(Project project, @Nullable Long parentId) {
        if (parentId == null) {
            return null;
        }
        final var parent = wbsItemRepository
            .findByProjectAndId(project, parentId)
            .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_WBS_ITEM.code(), parentId));
        if (parent.getDepth() >= WbsItem.MAX_DEPTH) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_WBS_DEPTH_LIMIT_EXCEEDED.code());
        }
        return parent;
    }

    /**
     * parent별 다음 sort order를 계산한다.
     *
     * @param nextSortOrderByParent parent별 다음 sort order 캐시
     * @param project 프로젝트
     * @param parent 부모 WBS
     * @return 다음 sort order
     */
    private int nextSortOrder(
        Map<WbsParentRef, Integer> nextSortOrderByParent,
        Project project,
        @Nullable WbsItem parent
    ) {
        final var parentRef = WbsParentRef.of(parent);
        final var next = nextSortOrderByParent.computeIfAbsent(parentRef, (ignored) ->
            wbsItemRepository.findNextSortOrder(project, parent)
        );
        nextSortOrderByParent.put(parentRef, next + 1);
        return next;
    }

    /**
     * 담당자 사용자를 조회하고 팀 소속 여부를 검증한다.
     *
     * @param team 팀
     * @param assigneeUserId 담당자 사용자 ID
     * @return 담당자 사용자
     */
    @Nullable
    private User resolveAssignee(Team team, @Nullable Long assigneeUserId) {
        if (assigneeUserId == null) {
            return null;
        }
        final var user = userRepository
            .findById(assigneeUserId)
            .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_USER.code(), assigneeUserId));
        if (!teamMemberRepository.existsByTeamAndUser(team, user)) {
            throw new DomainAccessDeniedException(MessageCode.ERROR_ACCESS_DENIED_NOT_MEMBER.code());
        }
        return user;
    }

    /**
     * 마일스톤을 조회한다.
     *
     * @param project 프로젝트
     * @param milestoneId 마일스톤 ID
     * @return 마일스톤
     */
    @Nullable
    private Milestone resolveMilestone(Project project, @Nullable Long milestoneId) {
        if (milestoneId == null) {
            return null;
        }
        return milestoneRepository
            .findByProjectAndId(project, milestoneId)
            .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_MILESTONE.code(), milestoneId));
    }
}
