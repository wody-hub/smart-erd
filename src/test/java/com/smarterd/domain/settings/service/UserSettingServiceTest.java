package com.smarterd.domain.settings.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.domain.settings.entity.UserSetting;
import com.smarterd.domain.settings.repository.UserSettingRepository;
import com.smarterd.domain.user.entity.User;
import com.smarterd.domain.user.service.AuthService;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class UserSettingServiceTest {

    @Mock
    private UserSettingRepository userSettingRepository;

    @Mock
    private AuthService authService;

    private UserSettingService userSettingService;

    @BeforeEach
    void setUp() {
        userSettingService = new UserSettingService(userSettingRepository, authService, new ObjectMapper());
    }

    @Test
    @DisplayName("getProjectWorkspaceTabOrder merges stored order with defaults")
    void getProjectWorkspaceTabOrder_mergesStoredOrderWithDefaults() {
        final var user = createUser(1L, "tester");
        final var setting = new UserSetting(user, "project-workspace-tab-order", "[\"documents\",\"issues\"]");

        when(authService.findUserByLoginId("tester")).thenReturn(user);
        when(userSettingRepository.findByUserAndSettingKey(user, "project-workspace-tab-order"))
            .thenReturn(Optional.of(setting));

        final var result = userSettingService.getProjectWorkspaceTabOrder("tester");

        assertThat(result.tabOrder()).containsExactly(
            "documents",
            "issues",
            "overview",
            "tags",
            "wbs",
            "myTasks",
            "gantt",
            "staffing"
        );
    }

    @Test
    @DisplayName("updateProjectWorkspaceTabOrder normalizes request and persists JSON")
    void updateProjectWorkspaceTabOrder_normalizesAndPersists() {
        final var user = createUser(1L, "tester");
        when(authService.findUserByLoginId("tester")).thenReturn(user);
        when(
            userSettingRepository.upsertSetting(
                1L,
                "project-workspace-tab-order",
                "[\"documents\",\"issues\",\"overview\",\"tags\",\"wbs\",\"myTasks\",\"gantt\",\"staffing\"]",
                "tester"
            )
        ).thenReturn(1);

        final var result = userSettingService.updateProjectWorkspaceTabOrder(
            "tester",
            List.of("documents", "issues", "documents", "unknown")
        );

        assertThat(result.tabOrder()).containsExactly(
            "documents",
            "issues",
            "overview",
            "tags",
            "wbs",
            "myTasks",
            "gantt",
            "staffing"
        );
        verify(userSettingRepository).upsertSetting(
            1L,
            "project-workspace-tab-order",
            "[\"documents\",\"issues\",\"overview\",\"tags\",\"wbs\",\"myTasks\",\"gantt\",\"staffing\"]",
            "tester"
        );
        verify(userSettingRepository, never()).save(org.mockito.ArgumentMatchers.any(UserSetting.class));
    }

    @Test
    @DisplayName("resolveProjectWorkspaceTabOrder falls back to defaults when input is empty")
    void resolveProjectWorkspaceTabOrder_emptyFallsBackToDefault() {
        assertThat(UserSettingService.resolveProjectWorkspaceTabOrder(List.of()))
            .containsExactly(
                "overview",
                "documents",
                "tags",
                "wbs",
                "myTasks",
                "gantt",
                "staffing",
                "issues"
            );
    }

    private User createUser(Long id, String loginId) {
        final var user = User.builder().loginId(loginId).password("encoded").name("Tester").build();
        ReflectionTestUtils.setField(user, "id", id);
        return user;
    }
}
