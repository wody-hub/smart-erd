package com.smarterd.domain.dictionary.service;

import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.exception.DuplicateException;
import com.smarterd.domain.common.exception.EntityNotFoundException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.dictionary.entity.DictionarySet;
import com.smarterd.domain.dictionary.entity.Word;
import com.smarterd.domain.dictionary.repository.WordRepository;
import com.smarterd.domain.team.entity.Team;
import com.smarterd.domain.team.service.TeamService;
import com.smarterd.domain.user.entity.User;
import com.smarterd.domain.user.service.AuthService;
import com.smarterd.utils.AppStringUtils;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 단어 사전 서비스.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class WordService {

    private static final int MAX_PAGE_SIZE = 5_000;

    private final WordRepository wordRepository;
    private final AuthService authService;
    private final TeamService teamService;
    private final DictionarySetService dictionarySetService;

    /**
     * 단어를 생성한다.
     *
     * @param loginId 요청 사용자 로그인 ID
     * @param teamId 팀 ID
     * @param setId 사전 세트 ID
     * @param logicalName 생성할 논리명
     * @param physicalName 생성할 물리명
     * @param description 생성할 설명
     * @return 생성된 단어 결과
     */
    @Transactional
    public WordResult createWord(
        String loginId,
        Long teamId,
        Long setId,
        String logicalName,
        String physicalName,
        String description
    ) {
        final var context = verifyWriteAccess(loginId, teamId, setId);

        if (wordRepository.existsByDictionarySetAndLogicalName(context.dictionarySet(), logicalName)) {
            throw new DuplicateException(MessageCode.ERROR_DUPLICATE_WORD_LOGICAL_NAME.code(), logicalName);
        }

        final var word = Word.builder()
            .logicalName(logicalName)
            .physicalName(physicalName)
            .description(description)
            .team(context.team())
            .dictionarySet(context.dictionarySet())
            .build();
        wordRepository.save(Objects.requireNonNull(word));
        return toWordResult(word);
    }

    /**
     * 팀의 단어 목록을 조회한다.
     *
     * @param loginId 요청 사용자 로그인 ID
     * @param teamId 팀 ID
     * @param setId 사전 세트 ID
     * @param page 페이지 번호
     * @param size 페이지 크기
     * @param keyword 복합 검색어
     * @return 단어 결과 페이지
     */
    public Page<WordResult> getWords(String loginId, Long teamId, Long setId, int page, int size, String keyword) {
        final var context = verifyReadAccess(loginId, teamId, setId);
        final var pageable = PageRequest.of(
            Math.max(page, 0),
            Math.min(Math.max(size, 1), MAX_PAGE_SIZE),
            Sort.by(Sort.Order.asc("logicalName"), Sort.Order.asc("id"))
        );
        final var normalizedKeyword = AppStringUtils.trimToNull(keyword);
        final var resultPage = (
            normalizedKeyword == null
                ? wordRepository.findByDictionarySet(context.dictionarySet(), pageable)
                : wordRepository.searchByDictionarySet(context.dictionarySet(), normalizedKeyword, pageable)
        ).map(this::toWordResult);
        return resultPage;
    }

    /**
     * 엑셀 내보내기용 전체 단어 목록을 조회한다.
     *
     * @param loginId 요청 사용자 로그인 ID
     * @param teamId 팀 ID
     * @param setId 사전 세트 ID
     * @return 사전 세트명과 정렬된 단어 목록
     */
    public WordExportResult getWordsForExport(String loginId, Long teamId, Long setId) {
        final var context = verifyReadAccess(loginId, teamId, setId);
        final var words = wordRepository
            .findByDictionarySetOrderByLogicalNameAscIdAsc(context.dictionarySet())
            .stream()
            .map(this::toWordResult)
            .toList();
        return new WordExportResult(context.dictionarySet().getName(), words);
    }

    /**
     * 단어 상세를 조회한다.
     *
     * @param loginId 요청 사용자 로그인 ID
     * @param teamId 팀 ID
     * @param setId 사전 세트 ID
     * @param wordId 단어 ID
     * @return 단어 결과
     */
    public WordResult getWord(String loginId, Long teamId, Long setId, Long wordId) {
        verifyReadAccess(loginId, teamId, setId);
        final var word = findWordById(wordId);
        verifyWordBelongsToTeam(word, teamId);
        verifyWordBelongsToSet(word, setId);
        return toWordResult(word);
    }

    /**
     * 단어를 수정한다.
     *
     * @param loginId 요청 사용자 로그인 ID
     * @param teamId 팀 ID
     * @param setId 사전 세트 ID
     * @param wordId 단어 ID
     * @param logicalName 변경할 논리명
     * @param physicalName 변경할 물리명
     * @param description 변경할 설명
     * @return 수정된 단어 결과
     */
    @Transactional
    public WordResult updateWord(
        String loginId,
        Long teamId,
        Long setId,
        Long wordId,
        String logicalName,
        String physicalName,
        String description
    ) {
        final var context = verifyWriteAccess(loginId, teamId, setId);
        final var word = findWordById(wordId);
        verifyWordBelongsToTeam(word, teamId);
        verifyWordBelongsToSet(word, setId);

        if (wordRepository.existsByDictionarySetAndLogicalNameAndIdNot(context.dictionarySet(), logicalName, wordId)) {
            throw new DuplicateException(MessageCode.ERROR_DUPLICATE_WORD_LOGICAL_NAME.code(), logicalName);
        }

        word.update(logicalName, physicalName, description);
        return toWordResult(word);
    }

    /**
     * 단어를 삭제한다.
     *
     * @param loginId 요청 사용자 로그인 ID
     * @param teamId 팀 ID
     * @param setId 사전 세트 ID
     * @param wordId 단어 ID
     */
    @Transactional
    public void deleteWord(String loginId, Long teamId, Long setId, Long wordId) {
        verifyWriteAccess(loginId, teamId, setId);
        final var word = findWordById(wordId);
        verifyWordBelongsToTeam(word, teamId);
        verifyWordBelongsToSet(word, setId);
        wordRepository.delete(word);
    }

    /**
     * 단어 ID로 단어를 조회한다.
     *
     * @param wordId 단어 ID
     * @return 단어 엔티티
     * @throws EntityNotFoundException 단어가 존재하지 않는 경우
     */
    public Word findWordById(Long wordId) {
        Objects.requireNonNull(wordId, "wordId must not be null");
        return wordRepository
            .findById(wordId)
            .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_WORD.code(), wordId));
    }

    /**
     * 읽기 접근을 검증한다.
     *
     * @param loginId 요청 사용자 로그인 ID
     * @param teamId 팀 ID
     * @param setId 사전 세트 ID
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
     * 쓰기 접근을 검증한다.
     *
     * @param loginId 요청 사용자 로그인 ID
     * @param teamId 팀 ID
     * @param setId 사전 세트 ID
     * @return 검증된 접근 컨텍스트
     */
    private AccessContext verifyWriteAccess(String loginId, Long teamId, Long setId) {
        final var user = authService.findUserByLoginId(loginId);
        final var team = teamService.findTeamById(teamId);
        teamService.verifyEditable(team, user);
        final var dictionarySet = dictionarySetService.findByTeamAndId(team, setId);
        return new AccessContext(user, team, dictionarySet);
    }

    /**
     * 단어가 해당 팀에 소속되어 있는지 검증한다.
     *
     * @param word 검증할 단어 엔티티
     * @param teamId 팀 ID
     */
    private void verifyWordBelongsToTeam(Word word, Long teamId) {
        if (!word.getTeam().getId().equals(teamId)) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_WORD_TEAM_MISMATCH.code());
        }
    }

    /**
     * 단어가 해당 사전 세트에 소속되어 있는지 검증한다.
     *
     * @param word 검증할 단어 엔티티
     * @param setId 사전 세트 ID
     */
    private void verifyWordBelongsToSet(Word word, Long setId) {
        if (word.getDictionarySet() == null || !word.getDictionarySet().getId().equals(setId)) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_DICTIONARY_SET_TEAM_MISMATCH.code());
        }
    }

    /**
     * 단어 엔티티를 서비스 결과로 변환한다.
     *
     * @param word 단어 엔티티
     * @return 서비스 계층 단어 결과
     */
    private WordResult toWordResult(Word word) {
        return new WordResult(
            word.getId(),
            word.getLogicalName(),
            word.getPhysicalName(),
            word.getDescription(),
            word.getTeam().getId(),
            word.getDictionarySet() != null ? word.getDictionarySet().getId() : null,
            word.getCreatedAt(),
            word.getUpdatedAt()
        );
    }

    /**
     * 접근 검증 결과를 담는 내부 컨텍스트.
     *
     * @param user 인증된 사용자
     * @param team 대상 팀
     * @param dictionarySet 대상 사전 세트
     */
    private record AccessContext(User user, Team team, DictionarySet dictionarySet) {}

    /**
     * 단어 응답용 서비스 결과.
     *
     * @param id 단어 ID
     * @param logicalName 논리명
     * @param physicalName 물리명
     * @param description 설명
     * @param teamId 소속 팀 ID
     * @param dictionarySetId 소속 사전 세트 ID
     * @param createdAt 생성 시각
     * @param updatedAt 수정 시각
     */
    public record WordResult(
        Long id,
        String logicalName,
        String physicalName,
        String description,
        Long teamId,
        Long dictionarySetId,
        Instant createdAt,
        Instant updatedAt
    ) {}

    /**
     * 단어 사전 엑셀 내보내기 결과.
     *
     * @param dictionarySetName 사전 세트명
     * @param words 정렬된 단어 목록
     */
    public record WordExportResult(String dictionarySetName, List<WordResult> words) {}
}
