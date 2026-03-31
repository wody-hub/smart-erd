package com.smarterd.domain.dictionary.entity;

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
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 도메인(데이터 타입 사전) 엔티티.
 *
 * <p>공통 표준 도메인명({@code logicalName})과 구조화된 데이터 타입 메타데이터를 정의한다.
 * 팀({@link Team}) 단위로 관리되며, {@link Term}에서 참조하여 컬럼 타입을 표준화한다.</p>
 *
 * @see Term
 */
@Entity
@Table(name = "domains", uniqueConstraints = @UniqueConstraint(columnNames = { "dictionary_set_id", "logical_name" }))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Domain extends BaseAuditEntity {

    /** 도메인 고유 식별자 (자동 증가) */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 표준 도메인명 (예: "명_V300", "금액_DECIMAL15_2", "내용") — 최대 100자 */
    @Column(nullable = false, length = 100)
    private String logicalName;

    /** 도메인 그룹 (선택) — 최대 100자 */
    @Column(length = 100)
    private String domainGroup;

    /** 도메인명 (선택) — 최대 100자 */
    @Column(length = 100)
    private String domainClassification;

    /** 구조화 데이터 타입 (예: "VARCHAR", "DECIMAL") — 최대 50자 */
    @Column(length = 50)
    private String dataType;

    /** 데이터 길이 (선택) */
    private Integer dataLength;

    /** 데이터 소수점 길이 (선택) */
    private Integer dataScale;

    /** 표시용 물리 데이터 타입 (예: "VARCHAR(50)", "BIGINT") — 최대 50자 */
    @Column(nullable = false, length = 50)
    private String physicalType;

    /** 소속 팀 */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "team_id", nullable = false)
    private Team team;

    /** 소속 사전 세트 */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "dictionary_set_id")
    private DictionarySet dictionarySet;

    /** 설명 (선택) — 최대 500자 */
    @Column(length = 500)
    private String description;

    /**
     * 도메인 엔티티를 생성한다.
     *
     * @param logicalName  표준 도메인명
     * @param domainGroup 도메인 그룹
     * @param domainClassification 도메인명
     * @param dataType 구조화 데이터 타입
     * @param dataLength 데이터 길이
     * @param dataScale 데이터 소수점 길이
     * @param physicalType 표시 물리 데이터 타입
     * @param team         소속 팀
     * @param description   설명 (nullable)
     * @param dictionarySet 소속 사전 세트
     */
    @Builder
    public Domain(
        String logicalName,
        String domainGroup,
        String domainClassification,
        String dataType,
        Integer dataLength,
        Integer dataScale,
        String physicalType,
        Team team,
        String description,
        DictionarySet dictionarySet
    ) {
        this.logicalName = logicalName;
        this.domainGroup = domainGroup;
        this.domainClassification = domainClassification;
        this.dataType = dataType;
        this.dataLength = dataLength;
        this.dataScale = dataScale;
        this.physicalType = physicalType;
        this.team = team;
        this.description = description;
        this.dictionarySet = dictionarySet;
    }

    /**
     * 도메인 정보를 수정한다.
     *
     * @param logicalName  표준 도메인명
     * @param domainGroup 도메인 그룹
     * @param domainClassification 도메인명
     * @param dataType 구조화 데이터 타입
     * @param dataLength 데이터 길이
     * @param dataScale 데이터 소수점 길이
     * @param physicalType 표시 물리 데이터 타입
     * @param description  설명 (nullable)
     */
    public void update(
        String logicalName,
        String domainGroup,
        String domainClassification,
        String dataType,
        Integer dataLength,
        Integer dataScale,
        String physicalType,
        String description
    ) {
        this.logicalName = logicalName;
        this.domainGroup = domainGroup;
        this.domainClassification = domainClassification;
        this.dataType = dataType;
        this.dataLength = dataLength;
        this.dataScale = dataScale;
        this.physicalType = physicalType;
        this.description = description;
    }
}
