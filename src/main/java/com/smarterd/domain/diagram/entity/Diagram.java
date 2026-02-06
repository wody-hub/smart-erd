package com.smarterd.domain.diagram.entity;

import com.smarterd.domain.common.entity.BaseTimeEntity;
import com.smarterd.domain.project.entity.Project;
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

/**
 * 다이어그램 엔티티.
 *
 * <p>프로젝트({@link Project}) 소속의 ERD 다이어그램을 나타낸다.
 * {@code content} 필드에 React Flow 노드·엣지 JSON을 직렬화하여 CLOB으로 저장한다.</p>
 *
 * @see com.smarterd.domain.project.entity.Project
 */
@Entity
@Table(name = "diagrams")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Diagram extends BaseTimeEntity {

    /** 다이어그램 고유 식별자 (자동 증가) */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 다이어그램 이름 (최대 100자) */
    @Column(nullable = false, length = 100)
    private String name;

    /** 소속 프로젝트 */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    /** 직렬화된 React Flow JSON (노드 + 엣지) */
    @Lob
    @Column(columnDefinition = "CLOB")
    private String content;

    /**
     * 다이어그램 엔티티를 생성한다.
     *
     * @param name    다이어그램 이름
     * @param project 소속 프로젝트
     * @param content 직렬화된 React Flow JSON
     */
    @Builder
    public Diagram(String name, Project project, String content) {
        this.name = name;
        this.project = project;
        this.content = content;
    }

    /**
     * 다이어그램의 콘텐츠를 갱신한다.
     *
     * @param content 새로운 React Flow JSON 문자열
     */
    public void updateContent(String content) {
        this.content = content;
    }
}
