package com.smarterd.domain.project.service;

import com.smarterd.domain.project.entity.Project;
import org.springframework.lang.Nullable;

/**
 * 프로젝트 진행률 제공 인터페이스.
 *
 * <p>project 도메인이 pm 도메인의 구현체에 직접 의존하지 않도록 DIP를 적용한다.</p>
 */
public interface ProjectProgressProvider {
    /**
     * 프로젝트의 평균 진행률을 반환한다.
     *
     * @param project 프로젝트 엔티티
     * @return 평균 진행률 (반올림), 항목이 없으면 {@code null}
     */
    @Nullable
    Integer getAverageProgressRate(Project project);
}
