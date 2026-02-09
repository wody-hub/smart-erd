package com.smarterd.domain.dictionary.service;

import com.smarterd.api.dictionary.dto.CreateDomainRequest;
import com.smarterd.api.dictionary.dto.DomainResponse;
import com.smarterd.api.dictionary.dto.UpdateDomainRequest;
import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.exception.DuplicateException;
import com.smarterd.domain.common.exception.EntityNotFoundException;
import com.smarterd.domain.dictionary.entity.Domain;
import com.smarterd.domain.dictionary.repository.DomainRepository;
import com.smarterd.domain.dictionary.repository.TermRepository;
import com.smarterd.domain.team.service.TeamService;
import com.smarterd.domain.user.service.AuthService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 도메인(데이터 타입 사전) 관련 비즈니스 로직 서비스.
 *
 * <p>도메인 CRUD를 처리하며, 팀 소속 여부 및 논리명 중복을 검증한다.</p>
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
@SuppressWarnings("null")
public class DomainService {

    /** 도메인 레포지토리 */
    private final DomainRepository domainRepository;

    /** 용어 레포지토리 (도메인 삭제 전 참조 확인) */
    private final TermRepository termRepository;

    /** 인증 서비스 (사용자 조회) */
    private final AuthService authService;

    /** 팀 서비스 (팀 조회, 멤버십 확인) */
    private final TeamService teamService;

    /**
     * 도메인을 생성한다.
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @param teamId  팀 ID
     * @param request 도메인 생성 요청
     * @return 생성된 도메인 응답
     */
    @Transactional
    public DomainResponse createDomain(String loginId, Long teamId, CreateDomainRequest request) {
        final var user = authService.findUserByLoginId(loginId);
        final var team = teamService.findTeamById(teamId);
        teamService.verifyMembership(team, user);

        if (domainRepository.existsByTeamAndLogicalName(team, request.logicalName())) {
            throw new DuplicateException("error.duplicate.domain-logical-name", request.logicalName());
        }

        final var domain = Domain.builder()
            .logicalName(request.logicalName())
            .physicalType(request.physicalType())
            .description(request.description())
            .team(team)
            .build();
        domainRepository.save(domain);

        return DomainResponse.from(domain);
    }

    /**
     * 팀의 도메인 목록을 조회한다.
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @param teamId  팀 ID
     * @return 도메인 응답 목록
     */
    public List<DomainResponse> getDomains(String loginId, Long teamId) {
        final var user = authService.findUserByLoginId(loginId);
        final var team = teamService.findTeamById(teamId);
        teamService.verifyMembership(team, user);

        return domainRepository.findByTeam(team).stream().map(DomainResponse::from).toList();
    }

    /**
     * 도메인 상세를 조회한다.
     *
     * @param loginId  요청 사용자의 로그인 ID
     * @param teamId   팀 ID
     * @param domainId 도메인 ID
     * @return 도메인 응답
     */
    public DomainResponse getDomain(String loginId, Long teamId, Long domainId) {
        final var user = authService.findUserByLoginId(loginId);
        final var team = teamService.findTeamById(teamId);
        teamService.verifyMembership(team, user);

        final var domain = findDomainById(domainId);
        verifyDomainBelongsToTeam(domain, teamId);

        return DomainResponse.from(domain);
    }

    /**
     * 도메인을 수정한다.
     *
     * @param loginId  요청 사용자의 로그인 ID
     * @param teamId   팀 ID
     * @param domainId 도메인 ID
     * @param request  도메인 수정 요청
     * @return 수정된 도메인 응답
     */
    @Transactional
    public DomainResponse updateDomain(String loginId, Long teamId, Long domainId, UpdateDomainRequest request) {
        final var user = authService.findUserByLoginId(loginId);
        final var team = teamService.findTeamById(teamId);
        teamService.verifyMembership(team, user);

        final var domain = findDomainById(domainId);
        verifyDomainBelongsToTeam(domain, teamId);

        if (domainRepository.existsByTeamAndLogicalNameAndIdNot(team, request.logicalName(), domainId)) {
            throw new DuplicateException("error.duplicate.domain-logical-name", request.logicalName());
        }

        domain.update(request.logicalName(), request.physicalType(), request.description());

        return DomainResponse.from(domain);
    }

    /**
     * 도메인을 삭제한다.
     *
     * @param loginId  요청 사용자의 로그인 ID
     * @param teamId   팀 ID
     * @param domainId 도메인 ID
     */
    @Transactional
    public void deleteDomain(String loginId, Long teamId, Long domainId) {
        final var user = authService.findUserByLoginId(loginId);
        final var team = teamService.findTeamById(teamId);
        teamService.verifyMembership(team, user);

        final var domain = findDomainById(domainId);
        verifyDomainBelongsToTeam(domain, teamId);

        final var termCount = termRepository.countByDomain(domain);
        if (termCount > 0) {
            throw new BusinessException("error.business.domain-in-use", termCount);
        }

        domainRepository.delete(domain);
    }

    /**
     * 도메인 ID로 도메인을 조회한다.
     *
     * @param domainId 도메인 ID
     * @return 도메인 엔티티
     * @throws EntityNotFoundException 도메인이 존재하지 않는 경우
     */
    public Domain findDomainById(Long domainId) {
        return domainRepository
            .findById(domainId)
            .orElseThrow(() -> new EntityNotFoundException("error.not-found.domain", domainId));
    }

    /**
     * 도메인이 해당 팀에 소속되어 있는지 확인한다.
     *
     * @param domain 도메인 엔티티
     * @param teamId 팀 ID
     * @throws BusinessException 도메인이 해당 팀에 소속되지 않은 경우
     */
    private void verifyDomainBelongsToTeam(Domain domain, Long teamId) {
        if (!domain.getTeam().getId().equals(teamId)) {
            throw new BusinessException("error.business.domain-team-mismatch");
        }
    }
}
