package com.smarterd.domain.pm.wbs.repository;

import com.smarterd.domain.pm.wbs.entity.WbsTemplate;
import com.smarterd.domain.project.entity.Project;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * {@link WbsTemplate} 데이터 접근 레포지토리.
 */
public interface WbsTemplateRepository extends JpaRepository<WbsTemplate, Long> {
    List<WbsTemplate> findByProjectOrderByUpdatedAtDescIdDesc(Project project);

    Optional<WbsTemplate> findByProjectAndId(Project project, Long id);
}
