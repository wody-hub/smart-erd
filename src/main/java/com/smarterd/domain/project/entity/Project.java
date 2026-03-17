package com.smarterd.domain.project.entity;

import com.smarterd.domain.common.entity.BaseAuditEntity;
import com.smarterd.domain.team.entity.Team;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
 * 프로젝트 엔티티.
 *
 * <p>팀({@link Team}) 소속으로 하나 이상의 {@link com.smarterd.domain.diagram.entity.Diagram}을 포함한다.
 * ERD 설계의 최상위 그룹 단위이다.</p>
 */
@Entity
@Table(name = "projects")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Project extends BaseAuditEntity {

    /** 프로젝트 고유 식별자 (자동 증가) */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 프로젝트 이름 (최대 100자) */
    @Column(nullable = false, length = 100)
    private String name;

    /** 프로젝트 설명 (최대 500자, nullable) */
    @Column(length = 500)
    private String description;

    /** 소속 팀 */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "team_id", nullable = false)
    private Team team;

    /**
     * 프로젝트 엔티티를 생성한다.
     *
     * @param name        프로젝트 이름
     * @param description 프로젝트 설명 (nullable)
     * @param team        소속 팀
     */
    @Builder
    public Project(String name, String description, Team team) {
        this.name = name;
        this.description = description;
        this.team = team;
    }

    /**
     * 프로젝트 정보를 변경한다.
     *
     * @param name        새 프로젝트 이름
     * @param description 새 프로젝트 설명 (nullable)
     */
    public void update(String name, String description) {
        this.name = name;
        this.description = description;
    }
}
