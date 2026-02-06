package com.smarterd.domain.team.service;

import com.smarterd.api.team.dto.*;
import com.smarterd.domain.team.entity.Team;
import com.smarterd.domain.team.entity.TeamMember;
import com.smarterd.domain.team.entity.TeamMemberRole;
import com.smarterd.domain.team.repository.TeamMemberRepository;
import com.smarterd.domain.team.repository.TeamRepository;
import com.smarterd.domain.user.entity.User;
import com.smarterd.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 팀 관련 비즈니스 로직 서비스.
 *
 * <p>팀 CRUD, 멤버 초대·제거·역할 변경 등을 처리한다.
 * 모든 팀 작업은 요청한 사용자의 팀 소속 여부 및 권한을 확인한다.</p>
 */
@Service
@RequiredArgsConstructor
public class TeamService {

    /** 팀 레포지토리 */
    private final TeamRepository teamRepository;

    /** 팀 멤버 레포지토리 */
    private final TeamMemberRepository teamMemberRepository;

    /** 사용자 레포지토리 */
    private final UserRepository userRepository;

    /**
     * 새 팀을 생성한다.
     *
     * <p>요청 사용자가 소유자(owner)이자 ADMIN 역할의 멤버가 된다.</p>
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @param request 팀 생성 요청
     * @return 생성된 팀 응답
     */
    @Transactional
    public TeamResponse createTeam(String loginId, CreateTeamRequest request) {
        User user = findUserByLoginId(loginId);

        Team team = Team.builder()
                .name(request.name())
                .owner(user)
                .build();
        teamRepository.save(team);

        TeamMember member = TeamMember.builder()
                .team(team)
                .user(user)
                .role(TeamMemberRole.ADMIN)
                .build();
        teamMemberRepository.save(member);

        return TeamResponse.from(team);
    }

    /**
     * 요청 사용자가 속한 팀 목록을 조회한다.
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @return 팀 응답 목록
     */
    @Transactional(readOnly = true)
    public List<TeamResponse> getMyTeams(String loginId) {
        User user = findUserByLoginId(loginId);
        List<TeamMember> memberships = teamMemberRepository.findByUser(user);
        return memberships.stream()
                .map(m -> TeamResponse.from(m.getTeam()))
                .toList();
    }

    /**
     * 팀 상세 정보를 조회한다.
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @param teamId  팀 ID
     * @return 팀 응답
     */
    @Transactional(readOnly = true)
    public TeamResponse getTeam(String loginId, Long teamId) {
        User user = findUserByLoginId(loginId);
        Team team = findTeamById(teamId);
        verifyMembership(team, user);
        return TeamResponse.from(team);
    }

    /**
     * 팀에 새 멤버를 초대한다.
     *
     * <p>요청 사용자가 해당 팀의 ADMIN 역할이어야 한다.</p>
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @param teamId  팀 ID
     * @param request 멤버 추가 요청
     * @return 추가된 멤버 응답
     */
    @Transactional
    public TeamMemberResponse addMember(String loginId, Long teamId, AddMemberRequest request) {
        User requester = findUserByLoginId(loginId);
        Team team = findTeamById(teamId);
        verifyAdmin(team, requester);

        User targetUser = findUserByLoginId(request.loginId());

        if (teamMemberRepository.existsByTeamAndUser(team, targetUser)) {
            throw new IllegalArgumentException("User is already a member of this team");
        }

        TeamMember member = TeamMember.builder()
                .team(team)
                .user(targetUser)
                .role(request.role())
                .build();
        teamMemberRepository.save(member);

        return TeamMemberResponse.from(member);
    }

    /**
     * 팀에서 멤버를 제거한다.
     *
     * <p>요청 사용자가 해당 팀의 ADMIN 역할이어야 한다.
     * 팀 소유자는 제거할 수 없다.</p>
     *
     * @param loginId  요청 사용자의 로그인 ID
     * @param teamId   팀 ID
     * @param userId   제거할 사용자 ID
     */
    @Transactional
    public void removeMember(String loginId, Long teamId, Long userId) {
        User requester = findUserByLoginId(loginId);
        Team team = findTeamById(teamId);
        verifyAdmin(team, requester);

        User targetUser = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (team.getOwner().getId().equals(userId)) {
            throw new IllegalArgumentException("Cannot remove team owner");
        }

        TeamMember member = teamMemberRepository.findByTeamAndUser(team, targetUser)
                .orElseThrow(() -> new IllegalArgumentException("User is not a member of this team"));
        teamMemberRepository.delete(member);
    }

    /**
     * 팀 멤버의 역할을 변경한다.
     *
     * <p>요청 사용자가 해당 팀의 ADMIN 역할이어야 한다.
     * 팀 소유자의 역할은 변경할 수 없다.</p>
     *
     * @param loginId  요청 사용자의 로그인 ID
     * @param teamId   팀 ID
     * @param userId   대상 사용자 ID
     * @param request  역할 변경 요청
     * @return 변경된 멤버 응답
     */
    @Transactional
    public TeamMemberResponse updateMemberRole(String loginId, Long teamId, Long userId,
                                                UpdateMemberRoleRequest request) {
        User requester = findUserByLoginId(loginId);
        Team team = findTeamById(teamId);
        verifyAdmin(team, requester);

        if (team.getOwner().getId().equals(userId)) {
            throw new IllegalArgumentException("Cannot change team owner's role");
        }

        User targetUser = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        TeamMember member = teamMemberRepository.findByTeamAndUser(team, targetUser)
                .orElseThrow(() -> new IllegalArgumentException("User is not a member of this team"));

        TeamMember updated = TeamMember.builder()
                .team(team)
                .user(targetUser)
                .role(request.role())
                .build();
        teamMemberRepository.delete(member);
        teamMemberRepository.flush();
        teamMemberRepository.save(updated);

        return TeamMemberResponse.from(updated);
    }

    /**
     * 팀의 멤버 목록을 조회한다.
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @param teamId  팀 ID
     * @return 멤버 응답 목록
     */
    @Transactional(readOnly = true)
    public List<TeamMemberResponse> getMembers(String loginId, Long teamId) {
        User user = findUserByLoginId(loginId);
        Team team = findTeamById(teamId);
        verifyMembership(team, user);
        return teamMemberRepository.findByTeam(team).stream()
                .map(TeamMemberResponse::from)
                .toList();
    }

    /**
     * 로그인 ID로 사용자를 조회한다.
     */
    private User findUserByLoginId(String loginId) {
        return userRepository.findByLoginId(loginId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + loginId));
    }

    /**
     * ID로 팀을 조회한다.
     */
    private Team findTeamById(Long teamId) {
        return teamRepository.findById(teamId)
                .orElseThrow(() -> new IllegalArgumentException("Team not found: " + teamId));
    }

    /**
     * 사용자가 팀의 멤버인지 확인한다.
     */
    private void verifyMembership(Team team, User user) {
        if (!teamMemberRepository.existsByTeamAndUser(team, user)) {
            throw new IllegalArgumentException("User is not a member of this team");
        }
    }

    /**
     * 사용자가 팀의 ADMIN인지 확인한다.
     */
    private void verifyAdmin(Team team, User user) {
        TeamMember member = teamMemberRepository.findByTeamAndUser(team, user)
                .orElseThrow(() -> new IllegalArgumentException("User is not a member of this team"));
        if (member.getRole() != TeamMemberRole.ADMIN) {
            throw new IllegalArgumentException("Only ADMIN can perform this action");
        }
    }
}
