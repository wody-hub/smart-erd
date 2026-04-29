package com.smarterd.domain.pm.wbs.entity;

import com.smarterd.domain.common.entity.BaseAuditEntity;
import com.smarterd.domain.project.entity.Project;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * WBS 선후행 관계 엔티티.
 */
@Entity
@Table(name = "wbs_dependencies")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class WbsDependency extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "predecessor_wbs_item_id", nullable = false)
    private WbsItem predecessor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "successor_wbs_item_id", nullable = false)
    private WbsItem successor;

    @Enumerated(EnumType.STRING)
    @Column(name = "dependency_type", nullable = false, length = 10)
    private WbsDependencyType dependencyType;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Builder
    public WbsDependency(
        Project project,
        WbsItem predecessor,
        WbsItem successor,
        WbsDependencyType dependencyType,
        int sortOrder
    ) {
        this.project = project;
        this.predecessor = predecessor;
        this.successor = successor;
        this.dependencyType = dependencyType;
        this.sortOrder = sortOrder;
    }

    public void update(WbsItem predecessor, WbsItem successor, WbsDependencyType dependencyType) {
        this.predecessor = predecessor;
        this.successor = successor;
        this.dependencyType = dependencyType;
    }
}
