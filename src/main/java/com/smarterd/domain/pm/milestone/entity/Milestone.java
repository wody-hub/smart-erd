package com.smarterd.domain.pm.milestone.entity;

import com.smarterd.domain.common.entity.BaseAuditEntity;
import com.smarterd.domain.project.entity.Project;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDate;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.lang.Nullable;

/**
 * 프로젝트 마일스톤 엔티티.
 */
@Entity
@Table(name = "milestones")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Milestone extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(name = "target_date", nullable = false)
    private LocalDate targetDate;

    @Nullable
    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Builder
    public Milestone(Project project, String name, LocalDate targetDate, @Nullable String description, int sortOrder) {
        this.project = project;
        this.name = name;
        this.targetDate = targetDate;
        this.description = description;
        this.sortOrder = sortOrder;
    }

    public void update(String name, LocalDate targetDate, @Nullable String description) {
        this.name = name;
        this.targetDate = targetDate;
        this.description = description;
    }

    public void updateSortOrder(int sortOrder) {
        this.sortOrder = sortOrder;
    }
}
