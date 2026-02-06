package com.smarterd.domain.dictionary.entity;

import com.smarterd.domain.common.entity.BaseTimeEntity;
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
 * 도메인(데이터 타입 사전) 엔티티.
 *
 * <p>논리명({@code logicalName})과 물리 데이터 타입({@code physicalType})의 매핑을 정의한다.
 * 팀({@link Team}) 단위로 관리되며, {@link Term}에서 참조하여 컬럼 타입을 표준화한다.</p>
 *
 * @see Term
 */
@Entity
@Table(name = "domains")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Domain extends BaseTimeEntity {

    /** 도메인 고유 식별자 (자동 증가) */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 논리명 (예: "이름", "금액") — 최대 100자 */
    @Column(nullable = false, length = 100)
    private String logicalName;

    /** 물리 데이터 타입 (예: "VARCHAR(50)", "BIGINT") — 최대 50자 */
    @Column(nullable = false, length = 50)
    private String physicalType;

    /** 소속 팀 */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "team_id", nullable = false)
    private Team team;

    /**
     * 도메인 엔티티를 생성한다.
     *
     * @param logicalName  논리명
     * @param physicalType 물리 데이터 타입
     * @param team         소속 팀
     */
    @Builder
    public Domain(String logicalName, String physicalType, Team team) {
        this.logicalName = logicalName;
        this.physicalType = physicalType;
        this.team = team;
    }
}
