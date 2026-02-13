package com.smarterd.domain.dictionary.service;

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
import com.smarterd.domain.user.service.AuthService;
import java.util.List;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
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
     * @param request 용어 생성 요청
     * @return 생성된 용어 응답
     */
    @Transactional
    public TermResponse createTerm(String loginId, Long teamId, Long setId, CreateTermRequest request) {
        final var user = authService.findUserByLoginId(loginId);
        final var team = teamService.findTeamById(teamId);
        teamService.verifyEditable(team, user);
        final var dictionarySet = dictionarySetService.findByTeamAndId(team, setId);

        if (termRepository.existsByDictionarySetAndLogicalName(dictionarySet, request.logicalName())) {
            throw new DuplicateException(MessageCode.ERROR_DUPLICATE_TERM_LOGICAL_NAME.code(), request.logicalName());
        }

        final var domain = resolveDomain(request.domainId(), team, dictionarySet);

        final var term = Term.builder()
            .logicalName(request.logicalName())
            .physicalName(request.physicalName())
            .description(request.description())
            .team(team)
            .dictionarySet(dictionarySet)
            .domain(domain)
            .build();
        termRepository.save(Objects.requireNonNull(term));

        return TermResponse.from(term);
    }

    /**
     * 팀의 용어 목록을 조회한다.
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @param teamId  팀 ID
     * @return 용어 응답 목록
     */
    public List<TermResponse> getTerms(String loginId, Long teamId, Long setId) {
        final var user = authService.findUserByLoginId(loginId);
        final var team = teamService.findTeamById(teamId);
        teamService.verifyMembership(team, user);
        final var dictionarySet = dictionarySetService.findByTeamAndId(team, setId);

        return termRepository.findByDictionarySetWithDomain(dictionarySet).stream().map(TermResponse::from).toList();
    }

    /**
     * 용어 상세를 조회한다.
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @param teamId  팀 ID
     * @param termId  용어 ID
     * @return 용어 응답
     */
    public TermResponse getTerm(String loginId, Long teamId, Long setId, Long termId) {
        final var user = authService.findUserByLoginId(loginId);
        final var team = teamService.findTeamById(teamId);
        teamService.verifyMembership(team, user);
        dictionarySetService.findByTeamAndId(team, setId);

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
     * @param termId  용어 ID
     * @param request 용어 수정 요청
     * @return 수정된 용어 응답
     */
    @Transactional
    public TermResponse updateTerm(String loginId, Long teamId, Long setId, Long termId, UpdateTermRequest request) {
        final var user = authService.findUserByLoginId(loginId);
        final var team = teamService.findTeamById(teamId);
        teamService.verifyEditable(team, user);
        final var dictionarySet = dictionarySetService.findByTeamAndId(team, setId);

        final var term = findTermById(termId);
        verifyTermBelongsToTeam(term, teamId);
        verifyTermBelongsToSet(term, setId);

        if (termRepository.existsByDictionarySetAndLogicalNameAndIdNot(dictionarySet, request.logicalName(), termId)) {
            throw new DuplicateException(MessageCode.ERROR_DUPLICATE_TERM_LOGICAL_NAME.code(), request.logicalName());
        }

        final var domain = resolveDomain(request.domainId(), team, dictionarySet);
        term.update(request.logicalName(), request.physicalName(), domain, request.description());

        return TermResponse.from(term);
    }

    /**
     * 용어를 삭제한다.
     *
     * @param loginId 요청 사용자의 로그인 ID
     * @param teamId  팀 ID
     * @param termId  용어 ID
     */
    @Transactional
    public void deleteTerm(String loginId, Long teamId, Long setId, Long termId) {
        final var user = authService.findUserByLoginId(loginId);
        final var team = teamService.findTeamById(teamId);
        teamService.verifyEditable(team, user);
        dictionarySetService.findByTeamAndId(team, setId);

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
        return termRepository
            .findById(Objects.requireNonNull(termId))
            .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_TERM.code(), termId));
    }

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

    private void verifyTermBelongsToSet(Term term, Long setId) {
        if (term.getDictionarySet() == null || !term.getDictionarySet().getId().equals(setId)) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_DICTIONARY_SET_TEAM_MISMATCH.code());
        }
    }

    /**
     * 도메인 ID를 기반으로 도메인 엔티티를 조회한다. null이면 null을 반환한다.
     *
     * @param domainId 도메인 ID (nullable)
     * @param team     요청 팀
     * @return 도메인 엔티티 또는 null
     * @throws EntityNotFoundException 도메인이 존재하지 않는 경우
     * @throws BusinessException       도메인이 해당 팀에 소속되지 않은 경우
     */
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
}
