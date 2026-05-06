package com.smarterd.domain.pm.wbs.entity;

import com.smarterd.domain.common.entity.BaseAuditEntity;
import com.smarterd.domain.project.entity.Project;
import jakarta.persistence.Access;
import jakarta.persistence.AccessType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.lang.Nullable;

/**
 * 프로젝트별 WBS subtree 스냅샷 템플릿.
 */
@Entity
@Table(name = "wbs_templates")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Access(AccessType.FIELD)
public class WbsTemplate extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @Column(nullable = false, length = 200)
    private String name;

    @Nullable
    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "root_name", nullable = false, length = 200)
    private String rootName;

    @Column(name = "item_count", nullable = false)
    private int itemCount;

    @Column(name = "dependency_count", nullable = false)
    private int dependencyCount;

    @Lob
    @Column(name = "payload_json", nullable = false, columnDefinition = "TEXT")
    private String payloadJson;

    @Builder
    public WbsTemplate(
        Project project,
        String name,
        @Nullable String description,
        String rootName,
        int itemCount,
        int dependencyCount,
        String payloadJson
    ) {
        this.project = project;
        this.name = name;
        this.description = description;
        this.rootName = rootName;
        this.itemCount = itemCount;
        this.dependencyCount = dependencyCount;
        this.payloadJson = payloadJson;
    }

    public void update(String name, @Nullable String description, String rootName, int itemCount, int dependencyCount, String payloadJson) {
        this.name = name;
        this.description = description;
        this.rootName = rootName;
        this.itemCount = itemCount;
        this.dependencyCount = dependencyCount;
        this.payloadJson = payloadJson;
    }
}
