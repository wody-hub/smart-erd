package com.smarterd.domain.pm.wbs.service;

import com.smarterd.domain.pm.wbs.repository.WbsItemRepository;
import com.smarterd.domain.project.entity.Project;
import com.smarterd.domain.project.service.ProjectProgressProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Component;

/**
 * WBS 기반 프로젝트 진행률 제공 구현체.
 */
@Component
@RequiredArgsConstructor
public class WbsProgressProvider implements ProjectProgressProvider {

    private final WbsItemRepository wbsItemRepository;

    @Override
    @Nullable
    public Integer getAverageProgressRate(Project project) {
        return wbsItemRepository.averageProgressRateByProject(project);
    }
}
