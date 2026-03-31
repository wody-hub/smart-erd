package com.smarterd.domain.dictionary.service;

import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.exception.DuplicateException;
import com.smarterd.domain.common.exception.EntityNotFoundException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.diagram.repository.DiagramRepository;
import com.smarterd.domain.dictionary.entity.DictionarySet;
import com.smarterd.domain.dictionary.repository.DictionarySetRepository;
import com.smarterd.domain.dictionary.repository.DomainRepository;
import com.smarterd.domain.dictionary.repository.TermRepository;
import com.smarterd.domain.dictionary.repository.WordRepository;
import com.smarterd.domain.team.entity.Team;
import com.smarterd.domain.team.service.TeamService;
import com.smarterd.domain.user.service.AuthService;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 사전 세트 관리 서비스.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DictionarySetService {

    /** 사전 세트 레포지토리 */
    private final DictionarySetRepository dictionarySetRepository;
    /** 다이어그램 레포지토리 */
    private final DiagramRepository diagramRepository;
    /** 도메인 레포지토리 */
    private final DomainRepository domainRepository;
    /** 용어 레포지토리 */
    private final TermRepository termRepository;
    /** 단어 레포지토리 */
    private final WordRepository wordRepository;
    /** 인증 서비스 */
    private final AuthService authService;
    /** 팀 서비스 */
    private final TeamService teamService;

    /**
     * 팀의 사전 세트 목록을 조회한다.
     *
     * @param loginId 요청 사용자 로그인 ID
     * @param teamId  팀 ID
     * @return 사전 세트 결과 목록
     */
    public List<DictionarySetResult> getDictionarySets(String loginId, Long teamId) {
        final var user = authService.findUserByLoginId(loginId);
        final var team = teamService.findTeamById(teamId);
        teamService.verifyMembership(team, user);

        return dictionarySetRepository
            .findByTeamOrderByCreatedAtAsc(team)
            .stream()
            .map(this::toDictionarySetResult)
            .toList();
    }

    /**
     * 팀의 단일 사전 세트를 조회한다.
     *
     * @param loginId 요청 사용자 로그인 ID
     * @param teamId  팀 ID
     * @param setId   사전 세트 ID
     * @return 사전 세트 결과
     */
    public DictionarySetResult getDictionarySet(String loginId, Long teamId, Long setId) {
        final var user = authService.findUserByLoginId(loginId);
        final var team = teamService.findTeamById(teamId);
        teamService.verifyMembership(team, user);

        return toDictionarySetResult(findByTeamAndId(team, setId));
    }

    /**
     * 사전 세트를 생성한다.
     *
     * <p>팀 row 락을 이용해 동일 팀 내 동시 생성 경쟁을 직렬화하고,
     * 현재 기본 세트 존재 여부에 따라 신규 세트의 기본 여부를 결정한다.</p>
     *
     * @param loginId 요청 사용자 로그인 ID
     * @param teamId  팀 ID
     * @param name 생성할 세트 이름
     * @param description 생성할 세트 설명
     * @return 생성된 사전 세트 결과
     */
    @Transactional
    public DictionarySetResult createDictionarySet(String loginId, Long teamId, String name, String description) {
        final var user = authService.findUserByLoginId(loginId);
        // 팀 row를 락으로 잡아 동일 팀 내 동시 생성 경쟁을 직렬화한다.
        final var team = teamService.findTeamByIdForUpdate(teamId);
        teamService.verifyEditable(team, user);

        if (dictionarySetRepository.existsByTeamAndName(team, name)) {
            throw new DuplicateException(MessageCode.ERROR_DUPLICATE_DICTIONARY_SET_NAME.code(), name);
        }

        final var isDefault = dictionarySetRepository.findFirstByTeamAndIsDefaultTrue(team).isEmpty();
        final var dictionarySet = Objects.requireNonNull(
            DictionarySet.builder().team(team).name(name).description(description).isDefault(isDefault).build()
        );

        dictionarySetRepository.save(dictionarySet);
        return toDictionarySetResult(dictionarySet);
    }

    /**
     * 사전 세트를 수정한다.
     *
     * @param loginId 요청 사용자 로그인 ID
     * @param teamId  팀 ID
     * @param setId   사전 세트 ID
     * @param name 변경할 세트 이름
     * @param description 변경할 세트 설명
     * @return 수정된 사전 세트 결과
     */
    @Transactional
    public DictionarySetResult updateDictionarySet(
        String loginId,
        Long teamId,
        Long setId,
        String name,
        String description
    ) {
        final var user = authService.findUserByLoginId(loginId);
        final var team = teamService.findTeamById(teamId);
        teamService.verifyEditable(team, user);

        final var dictionarySet = findByTeamAndId(team, setId);
        if (dictionarySetRepository.existsByTeamAndNameAndIdNot(team, name, setId)) {
            throw new DuplicateException(MessageCode.ERROR_DUPLICATE_DICTIONARY_SET_NAME.code(), name);
        }
        dictionarySet.update(name, description);
        return toDictionarySetResult(dictionarySet);
    }

    /**
     * 사전 세트를 삭제한다.
     *
     * <p>기본 세트는 삭제할 수 없으며, 다이어그램은 유지한 채 세트 참조만 해제한다.</p>
     *
     * @param loginId 요청 사용자 로그인 ID
     * @param teamId  팀 ID
     * @param setId   사전 세트 ID
     */
    @Transactional
    public void deleteDictionarySet(String loginId, Long teamId, Long setId) {
        final var user = authService.findUserByLoginId(loginId);
        final var team = teamService.findTeamById(teamId);
        teamService.verifyEditable(team, user);

        final var dictionarySet = findByTeamAndId(team, setId);
        if (dictionarySet.isDefault()) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_DICTIONARY_SET_DEFAULT_DELETE_FORBIDDEN.code());
        }

        // 다이어그램은 독립 리소스로 유지하고, 세트 참조만 해제한다.
        diagramRepository.clearDictionarySetReferences(dictionarySet);
        // FK 제약 순서: Term -> Domain -> DictionarySet
        termRepository.deleteByDictionarySet(dictionarySet);
        wordRepository.deleteByDictionarySet(dictionarySet);
        domainRepository.deleteByDictionarySet(dictionarySet);
        dictionarySetRepository.delete(dictionarySet);
    }

    /**
     * 기본 사전 세트를 지정한다.
     *
     * @param loginId 요청 사용자 로그인 ID
     * @param teamId  팀 ID
     * @param setId   기본으로 지정할 사전 세트 ID
     * @return 기본으로 지정된 사전 세트 결과
     */
    @Transactional
    public DictionarySetResult setDefaultDictionarySet(String loginId, Long teamId, Long setId) {
        final var user = authService.findUserByLoginId(loginId);
        final var team = teamService.findTeamById(teamId);
        teamService.verifyEditable(team, user);

        final var target = findByTeamAndId(team, setId);
        final var sets = dictionarySetRepository.findByTeamOrderByCreatedAtAsc(team);
        for (final var set : sets) {
            set.setDefault(set.getId().equals(target.getId()));
        }
        return toDictionarySetResult(target);
    }

    /**
     * 팀 범위에서 사전 세트를 조회한다.
     *
     * @param team  팀 엔티티
     * @param setId 사전 세트 ID
     * @return 사전 세트 엔티티
     * @throws EntityNotFoundException 팀 범위에서 세트를 찾을 수 없는 경우
     */
    public DictionarySet findByTeamAndId(Team team, Long setId) {
        return dictionarySetRepository
            .findByTeamAndId(team, setId)
            .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_DICTIONARY_SET.code(), setId));
    }

    /**
     * 팀의 기본 사전 세트를 조회하고, 없으면 생성한다.
     *
     * @param team 팀 엔티티
     * @return 기본 사전 세트 엔티티
     */
    @Transactional
    public DictionarySet findOrCreateDefaultSet(Team team) {
        final var dictionarySet = Objects.requireNonNull(
            DictionarySet.builder()
                .team(team)
                .name("Default")
                .description("Default dictionary set")
                .isDefault(true)
                .build()
        );
        return dictionarySetRepository
            .findFirstByTeamAndIsDefaultTrue(team)
            .orElseGet(() -> dictionarySetRepository.save(dictionarySet));
    }

    /**
     * 사전 세트 엔티티를 서비스 결과로 변환한다.
     *
     * @param dictionarySet 사전 세트 엔티티
     * @return 서비스 계층 사전 세트 결과
     */
    private DictionarySetResult toDictionarySetResult(DictionarySet dictionarySet) {
        return new DictionarySetResult(
            dictionarySet.getId(),
            dictionarySet.getName(),
            dictionarySet.getDescription(),
            dictionarySet.getTeam().getId(),
            dictionarySet.isDefault(),
            dictionarySet.getCreatedAt(),
            dictionarySet.getUpdatedAt()
        );
    }

    /**
     * 사전 세트 응답용 서비스 결과.
     *
     * @param id 세트 ID
     * @param name 세트 이름
     * @param description 세트 설명
     * @param teamId 소속 팀 ID
     * @param isDefault 기본 세트 여부
     * @param createdAt 생성 시각
     * @param updatedAt 수정 시각
     */
    public record DictionarySetResult(
        Long id,
        String name,
        String description,
        Long teamId,
        boolean isDefault,
        Instant createdAt,
        Instant updatedAt
    ) {}
}
