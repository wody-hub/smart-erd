package com.smarterd.domain.pm.todo.entity;

import com.smarterd.domain.common.entity.BaseAuditEntity;
import com.smarterd.domain.diagram.entity.Diagram;
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
 * 개인 TODO와 프로젝트 문서 간 연결 엔티티.
 */
@Entity
@Table(name = "todo_document_links")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TodoDocumentLink extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "todo_id", nullable = false)
    private ProjectTodo todo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "diagram_id", nullable = false)
    private Diagram diagram;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TodoDocumentVisibility visibility;

    @Builder
    public TodoDocumentLink(ProjectTodo todo, Diagram diagram, TodoDocumentVisibility visibility) {
        this.todo = todo;
        this.diagram = diagram;
        this.visibility = visibility;
    }

    public void updateVisibility(TodoDocumentVisibility visibility) {
        this.visibility = visibility;
    }
}
