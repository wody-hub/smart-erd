package com.smarterd.domain.diagram.entity;

import com.smarterd.domain.common.entity.BaseTimeEntity;
import com.smarterd.domain.project.entity.Project;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "diagrams")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Diagram extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @Lob
    @Column(columnDefinition = "CLOB")
    private String content;

    @Builder
    public Diagram(String name, Project project, String content) {
        this.name = name;
        this.project = project;
        this.content = content;
    }

    public void updateContent(String content) {
        this.content = content;
    }
}
