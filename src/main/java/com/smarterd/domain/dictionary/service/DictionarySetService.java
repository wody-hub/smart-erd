package com.smarterd.domain.dictionary.service;

import com.smarterd.api.dictionary.dto.CreateDictionarySetRequest;
import com.smarterd.api.dictionary.dto.DictionarySetResponse;
import com.smarterd.api.dictionary.dto.UpdateDictionarySetRequest;
import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.exception.DuplicateException;
import com.smarterd.domain.common.exception.EntityNotFoundException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.diagram.repository.DiagramRepository;
import com.smarterd.domain.dictionary.entity.DictionarySet;
import com.smarterd.domain.dictionary.repository.DictionarySetRepository;
import com.smarterd.domain.team.entity.Team;
import com.smarterd.domain.team.service.TeamService;
import com.smarterd.domain.user.service.AuthService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 사전 세트 관리 서비스.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
@SuppressWarnings("null")
public class DictionarySetService {

    private final DictionarySetRepository dictionarySetRepository;
    private final DiagramRepository diagramRepository;
    private final AuthService authService;
    private final TeamService teamService;

    public List<DictionarySetResponse> getDictionarySets(String loginId, Long teamId) {
        final var user = authService.findUserByLoginId(loginId);
        final var team = teamService.findTeamById(teamId);
        teamService.verifyMembership(team, user);

        return dictionarySetRepository.findByTeamOrderByCreatedAtAsc(team).stream().map(DictionarySetResponse::from).toList();
    }

    public DictionarySetResponse getDictionarySet(String loginId, Long teamId, Long setId) {
        final var user = authService.findUserByLoginId(loginId);
        final var team = teamService.findTeamById(teamId);
        teamService.verifyMembership(team, user);

        return DictionarySetResponse.from(findByTeamAndId(team, setId));
    }

    @Transactional
    public DictionarySetResponse createDictionarySet(String loginId, Long teamId, CreateDictionarySetRequest request) {
        final var user = authService.findUserByLoginId(loginId);
        final var team = teamService.findTeamById(teamId);
        teamService.verifyEditable(team, user);

        if (dictionarySetRepository.existsByTeamAndName(team, request.name())) {
            throw new DuplicateException(MessageCode.ERROR_DUPLICATE_DICTIONARY_SET_NAME.code(), request.name());
        }

        final var isDefault = dictionarySetRepository.countByTeam(team) == 0;
        final var dictionarySet = DictionarySet.builder()
            .team(team)
            .name(request.name())
            .description(request.description())
            .isDefault(isDefault)
            .build();

        dictionarySetRepository.save(dictionarySet);
        return DictionarySetResponse.from(dictionarySet);
    }

    @Transactional
    public DictionarySetResponse updateDictionarySet(
        String loginId,
        Long teamId,
        Long setId,
        UpdateDictionarySetRequest request
    ) {
        final var user = authService.findUserByLoginId(loginId);
        final var team = teamService.findTeamById(teamId);
        teamService.verifyEditable(team, user);

        final var dictionarySet = findByTeamAndId(team, setId);
        if (dictionarySetRepository.existsByTeamAndNameAndIdNot(team, request.name(), setId)) {
            throw new DuplicateException(MessageCode.ERROR_DUPLICATE_DICTIONARY_SET_NAME.code(), request.name());
        }
        dictionarySet.update(request.name(), request.description());
        return DictionarySetResponse.from(dictionarySet);
    }

    @Transactional
    public void deleteDictionarySet(String loginId, Long teamId, Long setId) {
        final var user = authService.findUserByLoginId(loginId);
        final var team = teamService.findTeamById(teamId);
        teamService.verifyEditable(team, user);

        final var dictionarySet = findByTeamAndId(team, setId);
        if (dictionarySet.isDefault()) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_DICTIONARY_SET_DEFAULT_DELETE_FORBIDDEN.code());
        }
        final var diagramRefCount = diagramRepository.countByDictionarySet(dictionarySet);
        if (diagramRefCount > 0) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_DIAGRAM_DICTIONARY_SET_IN_USE.code(), diagramRefCount);
        }

        dictionarySetRepository.delete(dictionarySet);
    }

    @Transactional
    public DictionarySetResponse setDefaultDictionarySet(String loginId, Long teamId, Long setId) {
        final var user = authService.findUserByLoginId(loginId);
        final var team = teamService.findTeamById(teamId);
        teamService.verifyEditable(team, user);

        final var target = findByTeamAndId(team, setId);
        final var sets = dictionarySetRepository.findByTeamOrderByCreatedAtAsc(team);
        for (final var set : sets) {
            set.setDefault(set.getId().equals(target.getId()));
        }
        return DictionarySetResponse.from(target);
    }

    public DictionarySet findByTeamAndId(Team team, Long setId) {
        final var dictionarySet = dictionarySetRepository
            .findById(setId)
            .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_DICTIONARY_SET.code(), setId));
        if (!dictionarySet.getTeam().getId().equals(team.getId())) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_DICTIONARY_SET_TEAM_MISMATCH.code());
        }
        return dictionarySet;
    }

    @Transactional
    public DictionarySet findOrCreateDefaultSet(Team team) {
        return dictionarySetRepository
            .findFirstByTeamAndIsDefaultTrue(team)
            .orElseGet(() ->
                dictionarySetRepository.save(
                    DictionarySet.builder().team(team).name("Default").description("Default dictionary set").isDefault(true).build()
                )
            );
    }
}

