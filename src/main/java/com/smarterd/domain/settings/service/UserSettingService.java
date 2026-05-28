package com.smarterd.domain.settings.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarterd.domain.settings.entity.UserSetting;
import com.smarterd.domain.settings.repository.UserSettingRepository;
import com.smarterd.domain.user.service.AuthService;
import com.smarterd.utils.AppStringUtils;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 사용자별 설정 조회/저장 서비스.
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class UserSettingService {

    static final String PROJECT_WORKSPACE_TAB_ORDER_KEY = "project-workspace-tab-order";
    static final List<String> DEFAULT_PROJECT_WORKSPACE_TAB_ORDER = List.of(
        "overview",
        "documents",
        "tags",
        "wbs",
        "myTasks",
        "gantt",
        "staffing",
        "issues"
    );

    private static final TypeReference<List<String>> STRING_LIST_TYPE = new TypeReference<>() {};

    private final UserSettingRepository userSettingRepository;
    private final AuthService authService;
    private final ObjectMapper objectMapper;

    /**
     * 프로젝트 작업공간 탭 순서를 조회한다.
     *
     * @param loginId 요청 사용자 로그인 ID
     * @return 정규화된 탭 순서
     */
    public ProjectWorkspaceTabOrderResult getProjectWorkspaceTabOrder(String loginId) {
        final var user = authService.findUserByLoginId(loginId);
        final var storedOrder = userSettingRepository
            .findByUserAndSettingKey(user, PROJECT_WORKSPACE_TAB_ORDER_KEY)
            .map(UserSetting::getSettingValue)
            .map(this::readStringList)
            .orElse(List.of());
        return new ProjectWorkspaceTabOrderResult(resolveProjectWorkspaceTabOrder(storedOrder));
    }

    /**
     * 프로젝트 작업공간 탭 순서를 저장한다.
     *
     * @param loginId 요청 사용자 로그인 ID
     * @param requestedOrder 요청한 탭 순서
     * @return 정규화되어 저장된 탭 순서
     */
    @Transactional
    public ProjectWorkspaceTabOrderResult updateProjectWorkspaceTabOrder(String loginId, List<String> requestedOrder) {
        final var user = authService.findUserByLoginId(loginId);
        final var normalizedOrder = resolveProjectWorkspaceTabOrder(requestedOrder);
        final var settingValue = writeStringList(normalizedOrder);
        userSettingRepository.upsertSetting(user.getId(), PROJECT_WORKSPACE_TAB_ORDER_KEY, settingValue, loginId);

        return new ProjectWorkspaceTabOrderResult(normalizedOrder);
    }

    /**
     * 요청/저장된 탭 순서를 지원 가능한 값으로 정규화한다.
     *
     * <p>알 수 없는 값은 버리고, 누락된 기본 탭은 뒤에 보강한다.</p>
     *
     * @param requestedOrder 원본 탭 순서
     * @return 정규화된 탭 순서
     */
    static List<String> resolveProjectWorkspaceTabOrder(List<String> requestedOrder) {
        final var normalized = new LinkedHashSet<String>();
        if (requestedOrder != null) {
            requestedOrder
                .stream()
                .filter(Objects::nonNull)
                .map(AppStringUtils::trimToNull)
                .filter(Objects::nonNull)
                .filter(DEFAULT_PROJECT_WORKSPACE_TAB_ORDER::contains)
                .forEach(normalized::add);
        }
        DEFAULT_PROJECT_WORKSPACE_TAB_ORDER.forEach(normalized::add);
        return List.copyOf(new ArrayList<>(normalized));
    }

    private List<String> readStringList(String rawValue) {
        try {
            final var parsed = objectMapper.readValue(rawValue, STRING_LIST_TYPE);
            return parsed == null ? List.of() : parsed;
        } catch (JsonProcessingException ex) {
            log.warn("Failed to parse user setting JSON. key={}", PROJECT_WORKSPACE_TAB_ORDER_KEY, ex);
            return List.of();
        }
    }

    private String writeStringList(List<String> values) {
        try {
            return objectMapper.writeValueAsString(values);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Failed to serialize user setting JSON", ex);
        }
    }

    /**
     * 프로젝트 작업공간 탭 순서 결과.
     *
     * @param tabOrder 저장된 탭 순서
     */
    public record ProjectWorkspaceTabOrderResult(List<String> tabOrder) {}
}
