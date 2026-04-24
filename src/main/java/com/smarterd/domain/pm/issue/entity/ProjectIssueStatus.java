package com.smarterd.domain.pm.issue.entity;

import org.springframework.lang.Nullable;

/**
 * 프로젝트 이슈 상태.
 */
public enum ProjectIssueStatus {
    REGISTERED,
    IN_PROGRESS,
    DONE;

    /**
     * 다음 전진 상태를 반환한다.
     *
     * @return 다음 상태, 더 이상 전진할 수 없으면 {@code null}
     */
    @Nullable
    public ProjectIssueStatus next() {
        return switch (this) {
            case REGISTERED -> IN_PROGRESS;
            case IN_PROGRESS -> DONE;
            case DONE -> null;
        };
    }
}
