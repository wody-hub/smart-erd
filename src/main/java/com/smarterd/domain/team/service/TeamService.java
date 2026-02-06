package com.smarterd.domain.team.service;

import com.smarterd.api.team.dto.AddMemberRequest;
import com.smarterd.api.team.dto.CreateTeamRequest;
import com.smarterd.api.team.dto.TeamMemberResponse;
import com.smarterd.api.team.dto.TeamResponse;
import com.smarterd.api.team.dto.UpdateMemberRoleRequest;
import com.smarterd.domain.common.exception.AccessDeniedException;
import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.exception.DuplicateException;
import com.smarterd.domain.common.exception.EntityNotFoundException;
import com.smarterd.domain.team.entity.Team;
import com.smarterd.domain.team.entity.TeamMember;
import com.smarterd.domain.team.entity.TeamMemberRole;
import com.smarterd.domain.team.repository.TeamMemberRepository;
import com.smarterd.domain.team.repository.TeamRepository;
import com.smarterd.domain.user.entity.User;
import com.smarterd.domain.user.repository.UserRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 팀 관련 비즈니스 로직 서비스.
 *
 * <p>
 * 팀 CRUD, 멤버 초대·제거·역할 변경 등을 처리한다. 모든 팀 작업은 요청한 사용자의 팀 소속 여부 및 권한을 확인한다.
 * </p>
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
@SuppressWarnings("null")
public class TeamService {

    private static final String NOT_A_MEMBER = "User is not a member of this team";

    /** 팀 레포지토리 */
    private final TeamRepository teamRepository;

    /** 팀 멤버 레포지토리 */
    private final TeamMemberRepository teamMemberRepository;

    /** 사용자 레포지토리 */
    private final UserRepository userRepository;

    /**
     * 새 팀을 생성한다.
     *
     * <p>
     * 요청 사용자가 소유자(owner)이자 ADMIN 역할의 멤버가 된다.
     * </p>
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @param request 팀 생성 요청
     * @return 생성된 팀 응답
     */
    @Transactional
    public TeamResponse createTeam(String loginId, CreateTeamRequest request) {
        var user = findUserByLoginId(loginId);

        var team = Team.builder().name(request.name()).owner(user).build();
        teamRepository.save(team);

        var member = TeamMember.builder().team(team).user(user).role(TeamMemberRole.ADMIN).build();
        teamMemberRepository.save(member);

        return TeamResponse.from(team);
    }

    /**
     * 요청 사용자가 속한 팀 목록을 조회한다.
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @return 팀 응답 목록
     */
    public List<TeamResponse> getMyTeams(String loginId) {
        var user = findUserByLoginId(loginId);
        return teamMemberRepository
            .findByUser(user)
            .stream()
            .map((m) -> TeamResponse.from(m.getTeam()))
            .toList();
    }

    /**
     * 팀 상세 정보를 조회한다.
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @param teamId  팀 ID
     * @return 팀 응답
     */
    public TeamResponse getTeam(String loginId, Long teamId) {
        var user = findUserByLoginId(loginId);
        var team = findTeamById(teamId);
        verifyMembership(team, user);
        return TeamResponse.from(team);
    }

    /**
     * 팀에 새 멤버를 초대한다.
     *
     * <p>
     * 요청 사용자가 해당 팀의 ADMIN 역할이어야 한다.
     * </p>
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @param teamId  팀 ID
     * @param request 멤버 추가 요청
     * @return 추가된 멤버 응답
     */
    @Transactional
    public TeamMemberResponse addMember(String loginId, Long teamId, AddMemberRequest request) {
        var requester = findUserByLoginId(loginId);
        var team = findTeamById(teamId);
        verifyAdmin(team, requester);

        var targetUser = findUserByLoginId(request.loginId());

        if (teamMemberRepository.existsByTeamAndUser(team, targetUser)) {
            throw new DuplicateException("User is already a member of this team");
        }

        var member = TeamMember.builder().team(team).user(targetUser).role(request.role()).build();
        teamMemberRepository.save(member);

        return TeamMemberResponse.from(member);
    }

    /**
     * 팀에서 멤버를 제거한다.
     *
     * <p>
     * 요청 사용자가 해당 팀의 ADMIN 역할이어야 한다. 팀 소유자는 제거할 수 없다.
     * </p>
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @param teamId  팀 ID
     * @param userId  제거할 사용자 ID
     */
    @Transactional
    public void removeMember(String loginId, Long teamId, Long userId) {
        var requester = findUserByLoginId(loginId);
        var team = findTeamById(teamId);
        verifyAdmin(team, requester);

        var targetUser = findUserById(userId);

        if (team.getOwner().getId().equals(targetUser.getId())) {
            throw new BusinessException("Cannot remove team owner");
        }

        var member = teamMemberRepository
            .findByTeamAndUser(team, targetUser)
            .orElseThrow(() -> new EntityNotFoundException(NOT_A_MEMBER));
        teamMemberRepository.delete(member);
    }

    /**
     * 팀 멤버의 역할을 변경한다.
     *
     * <p>
     * 요청 사용자가 해당 팀의 ADMIN 역할이어야 한다. 팀 소유자의 역할은 변경할 수 없다.
     * </p>
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @param teamId  팀 ID
     * @param userId  대상 사용자 ID
     * @param request 역할 변경 요청
     * @return 변경된 멤버 응답
     */
    @Transactional
    public TeamMemberResponse updateMemberRole(
        String loginId,
        Long teamId,
        Long userId,
        UpdateMemberRoleRequest request
    ) {
        var requester = findUserByLoginId(loginId);
        var team = findTeamById(teamId);
        verifyAdmin(team, requester);

        var targetUser = findUserById(userId);

        if (team.getOwner().getId().equals(targetUser.getId())) {
            throw new BusinessException("Cannot change team owner's role");
        }

        var member = teamMemberRepository
            .findByTeamAndUser(team, targetUser)
            .orElseThrow(() -> new EntityNotFoundException(NOT_A_MEMBER));
        member.changeRole(request.role());

        return TeamMemberResponse.from(member);
    }

    /**
     * 팀의 멤버 목록을 조회한다.
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @param teamId  팀 ID
     * @return 멤버 응답 목록
     */
    public List<TeamMemberResponse> getMembers(String loginId, Long teamId) {
        var user = findUserByLoginId(loginId);
        var team = findTeamById(teamId);
        verifyMembership(team, user);
        return teamMemberRepository.findByTeam(team).stream().map(TeamMemberResponse::from).toList();
    }

    private User findUserByLoginId(String loginId) {
        return userRepository
            .findByLoginId(loginId)
            .orElseThrow(() -> new EntityNotFoundException("User not found: " + loginId));
    }

    private User findUserById(Long userId) {
        return userRepository
            .findById(userId)
            .orElseThrow(() -> new EntityNotFoundException("User not found: " + userId));
    }

    private Team findTeamById(Long teamId) {
        return teamRepository
            .findById(teamId)
            .orElseThrow(() -> new EntityNotFoundException("Team not found: " + teamId));
    }

    private void verifyMembership(Team team, User user) {
        if (!teamMemberRepository.existsByTeamAndUser(team, user)) {
            throw new AccessDeniedException(NOT_A_MEMBER);
        }
    }

    private void verifyAdmin(Team team, User user) {
        var member = teamMemberRepository
            .findByTeamAndUser(team, user)
            .orElseThrow(() -> new AccessDeniedException(NOT_A_MEMBER));
        if (member.getRole() != TeamMemberRole.ADMIN) {
            throw new AccessDeniedException("Only ADMIN can perform this action");
        }
    }
}
