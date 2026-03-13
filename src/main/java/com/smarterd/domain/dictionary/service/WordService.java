package com.smarterd.domain.dictionary.service;

import com.smarterd.api.common.dto.PageResponse;
import com.smarterd.api.common.dto.PageSearchRequest;
import com.smarterd.api.dictionary.dto.CreateWordRequest;
import com.smarterd.api.dictionary.dto.UpdateWordRequest;
import com.smarterd.api.dictionary.dto.WordResponse;
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
import java.util.Objects;
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

    @Transactional
    public WordResponse createWord(String loginId, Long teamId, Long setId, CreateWordRequest request) {
        final var context = verifyWriteAccess(loginId, teamId, setId);

        if (wordRepository.existsByDictionarySetAndLogicalName(context.dictionarySet(), request.logicalName())) {
            throw new DuplicateException(MessageCode.ERROR_DUPLICATE_WORD_LOGICAL_NAME.code(), request.logicalName());
        }

        final var word = Word.builder()
            .logicalName(request.logicalName())
            .physicalName(request.physicalName())
            .description(request.description())
            .team(context.team())
            .dictionarySet(context.dictionarySet())
            .build();
        wordRepository.save(Objects.requireNonNull(word));
        return WordResponse.from(word);
    }

    public PageResponse<WordResponse> getWords(String loginId, Long teamId, Long setId, PageSearchRequest searchRequest) {
        final var context = verifyReadAccess(loginId, teamId, setId);
        final var pageable = searchRequest.toPageRequest(
            MAX_PAGE_SIZE,
            Sort.by(Sort.Order.asc("logicalName"), Sort.Order.asc("id"))
        );
        final var normalizedKeyword = searchRequest.normalizedKeyword();
        final var resultPage = (
            normalizedKeyword == null
                ? wordRepository.findByDictionarySet(context.dictionarySet(), pageable)
                : wordRepository.searchByDictionarySet(context.dictionarySet(), normalizedKeyword, pageable)
        ).map(WordResponse::from);
        return PageResponse.from(resultPage);
    }

    public WordResponse getWord(String loginId, Long teamId, Long setId, Long wordId) {
        verifyReadAccess(loginId, teamId, setId);
        final var word = findWordById(wordId);
        verifyWordBelongsToTeam(word, teamId);
        verifyWordBelongsToSet(word, setId);
        return WordResponse.from(word);
    }

    @Transactional
    public WordResponse updateWord(String loginId, Long teamId, Long setId, Long wordId, UpdateWordRequest request) {
        final var context = verifyWriteAccess(loginId, teamId, setId);
        final var word = findWordById(wordId);
        verifyWordBelongsToTeam(word, teamId);
        verifyWordBelongsToSet(word, setId);

        if (wordRepository.existsByDictionarySetAndLogicalNameAndIdNot(context.dictionarySet(), request.logicalName(), wordId)) {
            throw new DuplicateException(MessageCode.ERROR_DUPLICATE_WORD_LOGICAL_NAME.code(), request.logicalName());
        }

        word.update(request.logicalName(), request.physicalName(), request.description());
        return WordResponse.from(word);
    }

    @Transactional
    public void deleteWord(String loginId, Long teamId, Long setId, Long wordId) {
        verifyWriteAccess(loginId, teamId, setId);
        final var word = findWordById(wordId);
        verifyWordBelongsToTeam(word, teamId);
        verifyWordBelongsToSet(word, setId);
        wordRepository.delete(word);
    }

    public Word findWordById(Long wordId) {
        Objects.requireNonNull(wordId, "wordId must not be null");
        return wordRepository
            .findById(wordId)
            .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_WORD.code(), wordId));
    }

    private AccessContext verifyReadAccess(String loginId, Long teamId, Long setId) {
        final var user = authService.findUserByLoginId(loginId);
        final var team = teamService.findTeamById(teamId);
        teamService.verifyMembership(team, user);
        final var dictionarySet = dictionarySetService.findByTeamAndId(team, setId);
        return new AccessContext(user, team, dictionarySet);
    }

    private AccessContext verifyWriteAccess(String loginId, Long teamId, Long setId) {
        final var user = authService.findUserByLoginId(loginId);
        final var team = teamService.findTeamById(teamId);
        teamService.verifyEditable(team, user);
        final var dictionarySet = dictionarySetService.findByTeamAndId(team, setId);
        return new AccessContext(user, team, dictionarySet);
    }

    private void verifyWordBelongsToTeam(Word word, Long teamId) {
        if (!word.getTeam().getId().equals(teamId)) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_WORD_TEAM_MISMATCH.code());
        }
    }

    private void verifyWordBelongsToSet(Word word, Long setId) {
        if (word.getDictionarySet() == null || !word.getDictionarySet().getId().equals(setId)) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_DICTIONARY_SET_TEAM_MISMATCH.code());
        }
    }

    private record AccessContext(User user, Team team, DictionarySet dictionarySet) {}
}
