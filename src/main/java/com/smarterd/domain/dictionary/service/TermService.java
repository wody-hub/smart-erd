package com.smarterd.domain.dictionary.service;

import com.smarterd.api.common.dto.PageResponse;
import com.smarterd.api.common.dto.PageSearchRequest;
import com.smarterd.api.dictionary.dto.CreateTermRequest;
import com.smarterd.api.dictionary.dto.TermResponse;
import com.smarterd.api.dictionary.dto.UpdateTermRequest;
import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.exception.DuplicateException;
import com.smarterd.domain.common.exception.EntityNotFoundException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.dictionary.entity.DictionarySet;
import com.smarterd.domain.dictionary.entity.Domain;
import com.smarterd.domain.dictionary.entity.Term;
import com.smarterd.domain.dictionary.repository.TermRepository;
import com.smarterd.domain.team.entity.Team;
import com.smarterd.domain.team.service.TeamService;
import com.smarterd.domain.user.entity.User;
import com.smarterd.domain.user.service.AuthService;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 용어(이름 사전) 관련 비즈니스 로직 서비스.
 *
 * <p>용어 CRUD를 처리하며, 팀 소속 여부, 논리명 중복, 도메인 소속 검증을 수행한다.</p>
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TermService {

    private static final int MAX_PAGE_SIZE = 200;

    /** 용어 레포지토리 */
    private final TermRepository termRepository;

    /** 도메인 서비스 (도메인 참조 조회) */
    private final DomainService domainService;

    /** 인증 서비스 (사용자 조회) */
    private final AuthService authService;

    /** 팀 서비스 (팀 조회, 멤버십 확인) */
    private final TeamService teamService;

    /** 사전 세트 서비스 */
    private final DictionarySetService dictionarySetService;

    /**
     * 용어를 생성한다.
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @param teamId  팀 ID
     * @param setId   사전 세트 ID
     * @param request 용어 생성 요청
     * @return 생성된 용어 응답
     */
    @Transactional
    public TermResponse createTerm(String loginId, Long teamId, Long setId, CreateTermRequest request) {
        final var context = verifyWriteAccess(loginId, teamId, setId);

        if (termRepository.existsByDictionarySetAndLogicalName(context.dictionarySet(), request.logicalName())) {
            throw new DuplicateException(MessageCode.ERROR_DUPLICATE_TERM_LOGICAL_NAME.code(), request.logicalName());
        }

        final var domain = resolveDomain(request.domainId(), context.team(), context.dictionarySet());

        final var term = Term.builder()
            .logicalName(request.logicalName())
            .physicalName(request.physicalName())
            .description(request.description())
            .team(context.team())
            .dictionarySet(context.dictionarySet())
            .domain(domain)
            .build();
        termRepository.save(Objects.requireNonNull(term));

        return TermResponse.from(term);
    }

    /**
     * 팀의 용어 목록을 조회한다.
     *
     * @param loginId       요청 사용자의 로그인 ID
     * @param teamId        팀 ID
     * @param setId         사전 세트 ID
     * @param searchRequest 페이지네이션 + 검색 요청
     * @return 용어 응답 목록
     */
    public PageResponse<TermResponse> getTerms(
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
                ? termRepository.findByDictionarySet(context.dictionarySet(), pageable)
                : termRepository.searchByDictionarySet(context.dictionarySet(), normalizedKeyword, pageable)
        ).map(TermResponse::from);
        return PageResponse.from(resultPage);
    }

    /**
     * 용어 상세를 조회한다.
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @param teamId  팀 ID
     * @param setId   사전 세트 ID
     * @param termId  용어 ID
     * @return 용어 응답
     */
    public TermResponse getTerm(String loginId, Long teamId, Long setId, Long termId) {
        verifyReadAccess(loginId, teamId, setId);

        final var term = findTermById(termId);
        verifyTermBelongsToTeam(term, teamId);
        verifyTermBelongsToSet(term, setId);

        return TermResponse.from(term);
    }

    /**
     * 용어를 수정한다.
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @param teamId  팀 ID
     * @param setId   사전 세트 ID
     * @param termId  용어 ID
     * @param request 용어 수정 요청
     * @return 수정된 용어 응답
     */
    @Transactional
    public TermResponse updateTerm(String loginId, Long teamId, Long setId, Long termId, UpdateTermRequest request) {
        final var context = verifyWriteAccess(loginId, teamId, setId);

        final var term = findTermById(termId);
        verifyTermBelongsToTeam(term, teamId);
        verifyTermBelongsToSet(term, setId);

        if (
            termRepository.existsByDictionarySetAndLogicalNameAndIdNot(
                context.dictionarySet(),
                request.logicalName(),
                termId
            )
        ) {
            throw new DuplicateException(MessageCode.ERROR_DUPLICATE_TERM_LOGICAL_NAME.code(), request.logicalName());
        }

        final var domain = resolveDomain(request.domainId(), context.team(), context.dictionarySet());
        term.update(request.logicalName(), request.physicalName(), domain, request.description());

        return TermResponse.from(term);
    }

    /**
     * 용어를 삭제한다.
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @param teamId  팀 ID
     * @param setId   사전 세트 ID
     * @param termId  용어 ID
     */
    @Transactional
    public void deleteTerm(String loginId, Long teamId, Long setId, Long termId) {
        verifyWriteAccess(loginId, teamId, setId);

        final var term = Objects.requireNonNull(findTermById(termId));
        verifyTermBelongsToTeam(term, teamId);
        verifyTermBelongsToSet(term, setId);

        termRepository.delete(term);
    }

    /**
     * 용어 ID로 용어를 조회한다.
     *
     * @param termId 용어 ID
     * @return 용어 엔티티
     * @throws EntityNotFoundException 용어가 존재하지 않는 경우
     */
    private Term findTermById(Long termId) {
        Objects.requireNonNull(termId, "termId must not be null");
        return termRepository
            .findById(termId)
            .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_TERM.code(), termId));
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
     * 용어가 해당 팀에 소속되어 있는지 확인한다.
     *
     * @param term   용어 엔티티
     * @param teamId 팀 ID
     * @throws BusinessException 용어가 해당 팀에 소속되지 않은 경우
     */
    private void verifyTermBelongsToTeam(Term term, Long teamId) {
        if (!term.getTeam().getId().equals(teamId)) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_TERM_TEAM_MISMATCH.code());
        }
    }

    /**
     * 용어가 지정된 사전 세트에 소속되어 있는지 검증한다.
     *
     * @param term  검증 대상 용어 엔티티
     * @param setId 대상 사전 세트 ID
     * @throws BusinessException 용어가 해당 사전 세트에 소속되지 않은 경우
     */
    private void verifyTermBelongsToSet(Term term, Long setId) {
        if (term.getDictionarySet() == null || !term.getDictionarySet().getId().equals(setId)) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_DICTIONARY_SET_TEAM_MISMATCH.code());
        }
    }

    /**
     * 도메인 ID를 기반으로 도메인 엔티티를 조회한다. null이면 null을 반환한다.
     *
     * @param domainId      도메인 ID (nullable)
     * @param team          요청 팀
     * @param dictionarySet 대상 사전 세트
     * @return 도메인 엔티티 또는 null
     * @throws EntityNotFoundException 도메인이 존재하지 않는 경우
     * @throws BusinessException       도메인이 해당 팀에 소속되지 않은 경우
     */
    @Nullable
    private Domain resolveDomain(Long domainId, Team team, DictionarySet dictionarySet) {
        if (domainId == null) {
            return null;
        }
        final var domain = domainService.findDomainById(domainId);
        if (!domain.getTeam().getId().equals(team.getId())) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_TERM_DOMAIN_TEAM_MISMATCH.code());
        }
        if (domain.getDictionarySet() == null || !domain.getDictionarySet().getId().equals(dictionarySet.getId())) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_TERM_DOMAIN_SET_MISMATCH.code());
        }
        return domain;
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
