package com.smarterd.domain.dictionary.service;

import com.smarterd.api.common.dto.PageResponse;
import com.smarterd.api.common.dto.PageSearchRequest;
import com.smarterd.api.dictionary.dto.CreateDomainRequest;
import com.smarterd.api.dictionary.dto.DomainResponse;
import com.smarterd.api.dictionary.dto.UpdateDomainRequest;
import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.exception.DuplicateException;
import com.smarterd.domain.common.exception.EntityNotFoundException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.dictionary.entity.DictionarySet;
import com.smarterd.domain.dictionary.entity.Domain;
import com.smarterd.domain.dictionary.repository.DomainRepository;
import com.smarterd.domain.dictionary.repository.TermRepository;
import com.smarterd.domain.team.entity.Team;
import com.smarterd.domain.team.service.TeamService;
import com.smarterd.domain.user.entity.User;
import com.smarterd.domain.user.service.AuthService;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
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
public class DomainService {

    private static final int MAX_PAGE_SIZE = 5_000;

    /** 도메인 레포지토리 */
    private final DomainRepository domainRepository;

    /** 용어 레포지토리 (도메인 삭제 전 참조 확인) */
    private final TermRepository termRepository;

    /** 인증 서비스 (사용자 조회) */
    private final AuthService authService;

    /** 팀 서비스 (팀 조회, 멤버십 확인) */
    private final TeamService teamService;

    /** 사전 세트 서비스 */
    private final DictionarySetService dictionarySetService;

    /**
     * 도메인을 생성한다.
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @param teamId  팀 ID
     * @param setId   사전 세트 ID
     * @param request 도메인 생성 요청
     * @return 생성된 도메인 응답
     */
    @Transactional
    public DomainResponse createDomain(String loginId, Long teamId, Long setId, CreateDomainRequest request) {
        final var context = verifyWriteAccess(loginId, teamId, setId);

        if (domainRepository.existsByDictionarySetAndLogicalName(context.dictionarySet(), request.logicalName())) {
            throw new DuplicateException(MessageCode.ERROR_DUPLICATE_DOMAIN_LOGICAL_NAME.code(), request.logicalName());
        }

        final var domain = Domain.builder()
            .logicalName(request.logicalName())
            .physicalType(request.physicalType())
            .description(request.description())
            .team(context.team())
            .dictionarySet(context.dictionarySet())
            .build();
        domainRepository.save(Objects.requireNonNull(domain));

        return DomainResponse.from(domain);
    }

    /**
     * 팀의 도메인 목록을 조회한다.
     *
     * @param loginId       요청 사용자의 로그인 ID
     * @param teamId        팀 ID
     * @param setId         사전 세트 ID
     * @param searchRequest 페이지네이션 + 검색 요청
     * @return 도메인 응답 목록
     */
    public PageResponse<DomainResponse> getDomains(
        String loginId,
        Long teamId,
        Long setId,
        PageSearchRequest searchRequest
    ) {
        final var context = verifyReadAccess(loginId, teamId, setId);

        final var pageable = searchRequest.toPageRequest(
            MAX_PAGE_SIZE,
            Sort.by(Sort.Order.asc("logicalName"), Sort.Order.asc("id"))
        );
        final var normalizedKeyword = searchRequest.normalizedKeyword();
        final var resultPage = (
            normalizedKeyword == null
                ? domainRepository.findByDictionarySet(context.dictionarySet(), pageable)
                : domainRepository.searchByDictionarySet(context.dictionarySet(), normalizedKeyword, pageable)
        ).map(DomainResponse::from);
        return PageResponse.from(resultPage);
    }

    /**
     * 도메인 상세를 조회한다.
     *
     * @param loginId  요청 사용자의 로그인 ID
     * @param teamId   팀 ID
     * @param setId    사전 세트 ID
     * @param domainId 도메인 ID
     * @return 도메인 응답
     */
    public DomainResponse getDomain(String loginId, Long teamId, Long setId, Long domainId) {
        verifyReadAccess(loginId, teamId, setId);

        final var domain = findDomainById(domainId);
        verifyDomainBelongsToTeam(domain, teamId);
        verifyDomainBelongsToSet(domain, setId);

        return DomainResponse.from(domain);
    }

    /**
     * 도메인을 수정한다.
     *
     * @param loginId  요청 사용자의 로그인 ID
     * @param teamId   팀 ID
     * @param setId    사전 세트 ID
     * @param domainId 도메인 ID
     * @param request  도메인 수정 요청
     * @return 수정된 도메인 응답
     */
    @Transactional
    public DomainResponse updateDomain(
        String loginId,
        Long teamId,
        Long setId,
        Long domainId,
        UpdateDomainRequest request
    ) {
        final var context = verifyWriteAccess(loginId, teamId, setId);

        final var domain = findDomainById(domainId);
        verifyDomainBelongsToTeam(domain, teamId);
        verifyDomainBelongsToSet(domain, setId);

        if (
            domainRepository.existsByDictionarySetAndLogicalNameAndIdNot(
                context.dictionarySet(),
                request.logicalName(),
                domainId
            )
        ) {
            throw new DuplicateException(MessageCode.ERROR_DUPLICATE_DOMAIN_LOGICAL_NAME.code(), request.logicalName());
        }

        domain.update(request.logicalName(), request.physicalType(), request.description());

        return DomainResponse.from(domain);
    }

    /**
     * 도메인을 삭제한다.
     *
     * @param loginId  요청 사용자의 로그인 ID
     * @param teamId   팀 ID
     * @param setId    사전 세트 ID
     * @param domainId 도메인 ID
     */
    @Transactional
    public void deleteDomain(String loginId, Long teamId, Long setId, Long domainId) {
        verifyWriteAccess(loginId, teamId, setId);

        final var domain = Objects.requireNonNull(findDomainById(domainId));
        verifyDomainBelongsToTeam(domain, teamId);
        verifyDomainBelongsToSet(domain, setId);

        final var termCount = termRepository.countByDomain(domain);
        if (termCount > 0) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_DOMAIN_IN_USE.code(), termCount);
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
        Objects.requireNonNull(domainId, "domainId must not be null");
        return domainRepository
            .findById(domainId)
            .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_DOMAIN.code(), domainId));
    }

    // ── 접근 검증 메서드 ──

    /**
     * 읽기 접근을 검증한다. 모든 팀 멤버가 접근 가능하다.
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @param teamId  팀 ID
     * @param setId   사전 세트 ID
     * @return 검증된 접근 컨텍스트
     */
    private AccessContext verifyReadAccess(String loginId, Long teamId, Long setId) {
        final var user = authService.findUserByLoginId(loginId);
        final var team = teamService.findTeamById(teamId);
        teamService.verifyMembership(team, user);
        final var dictionarySet = dictionarySetService.findByTeamAndId(team, setId);
        return new AccessContext(user, team, dictionarySet);
    }

    /**
     * 쓰기 접근을 검증한다. ADMIN과 MEMBER만 접근 가능하다.
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @param teamId  팀 ID
     * @param setId   사전 세트 ID
     * @return 검증된 접근 컨텍스트
     */
    private AccessContext verifyWriteAccess(String loginId, Long teamId, Long setId) {
        final var user = authService.findUserByLoginId(loginId);
        final var team = teamService.findTeamById(teamId);
        teamService.verifyEditable(team, user);
        final var dictionarySet = dictionarySetService.findByTeamAndId(team, setId);
        return new AccessContext(user, team, dictionarySet);
    }

    // ── 소속 검증 메서드 ──

    /**
     * 도메인이 해당 팀에 소속되어 있는지 확인한다.
     *
     * @param domain 도메인 엔티티
     * @param teamId 팀 ID
     * @throws BusinessException 도메인이 해당 팀에 소속되지 않은 경우
     */
    private void verifyDomainBelongsToTeam(Domain domain, Long teamId) {
        if (!domain.getTeam().getId().equals(teamId)) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_DOMAIN_TEAM_MISMATCH.code());
        }
    }

    /**
     * 도메인이 요청한 사전 세트에 소속되어 있는지 확인한다.
     *
     * @param domain 도메인 엔티티
     * @param setId  사전 세트 ID
     * @throws BusinessException 도메인이 해당 사전 세트에 소속되지 않은 경우
     */
    private void verifyDomainBelongsToSet(Domain domain, Long setId) {
        if (domain.getDictionarySet() == null || !domain.getDictionarySet().getId().equals(setId)) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_DICTIONARY_SET_TEAM_MISMATCH.code());
        }
    }

    /**
     * 접근 검증 결과를 담는 내부 컨텍스트.
     *
     * @param user          인증된 사용자
     * @param team          대상 팀
     * @param dictionarySet 대상 사전 세트
     */
    private record AccessContext(User user, Team team, DictionarySet dictionarySet) {}
}
