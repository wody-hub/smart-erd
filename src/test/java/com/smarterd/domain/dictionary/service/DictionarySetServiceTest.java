package com.smarterd.domain.dictionary.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.exception.EntityNotFoundException;
import com.smarterd.domain.diagram.repository.DiagramRepository;
import com.smarterd.domain.dictionary.entity.DictionarySet;
import com.smarterd.domain.dictionary.repository.DictionarySetRepository;
import com.smarterd.domain.dictionary.repository.DomainRepository;
import com.smarterd.domain.dictionary.repository.TermRepository;
import com.smarterd.domain.dictionary.repository.WordRepository;
import com.smarterd.domain.team.entity.Team;
import com.smarterd.domain.team.service.TeamService;
import com.smarterd.domain.user.entity.User;
import com.smarterd.domain.user.service.AuthService;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@SuppressWarnings("null")
@ExtendWith(MockitoExtension.class)
class DictionarySetServiceTest {

    @Mock
    private DictionarySetRepository dictionarySetRepository;

    @Mock
    private DiagramRepository diagramRepository;

    @Mock
    private DomainRepository domainRepository;

    @Mock
    private TermRepository termRepository;

    @Mock
    private WordRepository wordRepository;

    @Mock
    private AuthService authService;

    @Mock
    private TeamService teamService;

    @InjectMocks
    private DictionarySetService dictionarySetService;

    @Test
    @DisplayName("createDictionarySet - 기본 세트가 없으면 생성 세트를 default로 저장한다")
    void createDictionarySet_withoutDefault_savesDefaultSet() {
        // given
        final var loginId = "tester";
        final var teamId = 1L;
        final var user = createUser(1L, loginId);
        final var team = createTeam(1L, user);

        when(authService.findUserByLoginId(loginId)).thenReturn(user);
        when(teamService.findTeamByIdForUpdate(teamId)).thenReturn(team);
        when(dictionarySetRepository.existsByTeamAndName(team, "Set-A")).thenReturn(false);
        when(dictionarySetRepository.findFirstByTeamAndIsDefaultTrue(team)).thenReturn(Optional.empty());
        when(dictionarySetRepository.save(any(DictionarySet.class))).thenAnswer((invocation) ->
            invocation.getArgument(0, DictionarySet.class)
        );

        // when
        final var response = dictionarySetService.createDictionarySet(
            loginId,
            teamId,
            "Set-A",
            "desc"
        );

        // then
        final var captor = ArgumentCaptor.forClass(DictionarySet.class);
        verify(dictionarySetRepository).save(captor.capture());
        final var saved = captor.getValue();
        assertThat(saved.isDefault()).isTrue();
        assertThat(response.isDefault()).isTrue();
        verify(teamService, never()).findTeamById(teamId);
    }

    @Test
    @DisplayName("createDictionarySet - 기존 기본 세트가 있으면 non-default로 저장한다")
    void createDictionarySet_withExistingDefault_savesNonDefaultSet() {
        // given
        final var loginId = "tester";
        final var teamId = 1L;
        final var user = createUser(1L, loginId);
        final var team = createTeam(1L, user);
        final var existingDefault = createDictionarySet(10L, team, true);

        when(authService.findUserByLoginId(loginId)).thenReturn(user);
        when(teamService.findTeamByIdForUpdate(teamId)).thenReturn(team);
        when(dictionarySetRepository.existsByTeamAndName(team, "Set-B")).thenReturn(false);
        when(dictionarySetRepository.findFirstByTeamAndIsDefaultTrue(team)).thenReturn(Optional.of(existingDefault));
        when(dictionarySetRepository.save(any(DictionarySet.class))).thenAnswer((invocation) ->
            invocation.getArgument(0, DictionarySet.class)
        );

        // when
        final var response = dictionarySetService.createDictionarySet(
            loginId,
            teamId,
            "Set-B",
            "desc"
        );

        // then
        final var captor = ArgumentCaptor.forClass(DictionarySet.class);
        verify(dictionarySetRepository).save(captor.capture());
        final var saved = captor.getValue();
        assertThat(saved.isDefault()).isFalse();
        assertThat(response.isDefault()).isFalse();
        verify(teamService, never()).findTeamById(teamId);
    }

    @Test
    @DisplayName("deleteDictionarySet - 다이어그램 참조를 해제하고 용어/도메인/세트를 순서대로 삭제한다")
    void deleteDictionarySet_clearsDiagramReferencesAndDeletesChildren() {
        // given
        final var loginId = "tester";
        final var teamId = 1L;
        final var setId = 10L;
        final var user = createUser(1L, loginId);
        final var team = createTeam(1L, user);
        final var dictionarySet = createDictionarySet(setId, team, false);

        when(authService.findUserByLoginId(loginId)).thenReturn(user);
        when(teamService.findTeamById(teamId)).thenReturn(team);
        when(dictionarySetRepository.findByTeamAndId(team, setId)).thenReturn(Optional.of(dictionarySet));

        // when
        dictionarySetService.deleteDictionarySet(loginId, teamId, setId);

        // then
        verify(diagramRepository).clearDictionarySetReferences(dictionarySet);
        verify(termRepository).deleteByDictionarySet(dictionarySet);
        verify(wordRepository).deleteByDictionarySet(dictionarySet);
        verify(domainRepository).deleteByDictionarySet(dictionarySet);
        verify(dictionarySetRepository).delete(dictionarySet);
    }

    @Test
    @DisplayName("deleteDictionarySet - 기본 세트는 삭제할 수 없다")
    void deleteDictionarySet_defaultSet_throwsBusinessException() {
        // given
        final var loginId = "tester";
        final var teamId = 1L;
        final var setId = 10L;
        final var user = createUser(1L, loginId);
        final var team = createTeam(1L, user);
        final var dictionarySet = createDictionarySet(setId, team, true);

        when(authService.findUserByLoginId(loginId)).thenReturn(user);
        when(teamService.findTeamById(teamId)).thenReturn(team);
        when(dictionarySetRepository.findByTeamAndId(team, setId)).thenReturn(Optional.of(dictionarySet));

        // when & then
        assertThatThrownBy(() -> dictionarySetService.deleteDictionarySet(loginId, teamId, setId)).isInstanceOf(
            BusinessException.class
        );

        verify(diagramRepository, never()).clearDictionarySetReferences(dictionarySet);
        verify(termRepository, never()).deleteByDictionarySet(dictionarySet);
        verify(wordRepository, never()).deleteByDictionarySet(dictionarySet);
        verify(domainRepository, never()).deleteByDictionarySet(dictionarySet);
        verify(dictionarySetRepository, never()).delete(dictionarySet);
    }

    @Test
    @DisplayName("findByTeamAndId - 팀+세트 조합이 없으면 404 예외를 던진다")
    void findByTeamAndId_notFound_throwsEntityNotFoundException() {
        // given
        final var user = createUser(1L, "tester");
        final var team = createTeam(1L, user);
        final var setId = 999L;
        when(dictionarySetRepository.findByTeamAndId(team, setId)).thenReturn(Optional.empty());

        // when & then
        assertThatThrownBy(() -> dictionarySetService.findByTeamAndId(team, setId)).isInstanceOf(
            EntityNotFoundException.class
        );

        verify(dictionarySetRepository, never()).findById(anyLong());
    }

    private User createUser(Long id, String loginId) {
        final var user = User.builder().loginId(loginId).password("pw").name("Tester").build();
        ReflectionTestUtils.setField(user, "id", id);
        return user;
    }

    private Team createTeam(Long id, User owner) {
        final var team = Team.builder().name("Team").owner(owner).build();
        ReflectionTestUtils.setField(team, "id", id);
        return team;
    }

    private DictionarySet createDictionarySet(Long id, Team team, boolean isDefault) {
        final var dictionarySet = DictionarySet.builder()
            .team(team)
            .name("Set")
            .description("desc")
            .isDefault(isDefault)
            .build();
        ReflectionTestUtils.setField(dictionarySet, "id", id);
        return dictionarySet;
    }
}
