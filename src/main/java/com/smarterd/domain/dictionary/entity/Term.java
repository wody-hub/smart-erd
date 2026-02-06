package com.smarterd.domain.dictionary.entity;

import com.smarterd.domain.common.entity.BaseTimeEntity;
import com.smarterd.domain.team.entity.Team;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 용어(이름 사전) 엔티티.
 *
 * <p>논리명({@code logicalName})과 물리명({@code physicalName})의 매핑을 정의한다.
 * 선택적으로 {@link Domain}을 참조하여 해당 용어의 데이터 타입까지 함께 표준화할 수 있다.
 * 팀({@link com.smarterd.domain.team.entity.Team}) 단위로 관리된다.</p>
 *
 * @see Domain
 */
@Entity
@Table(name = "terms")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Term extends BaseTimeEntity {

    /** 용어 고유 식별자 (자동 증가) */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 논리명 (예: "사용자명") — 최대 100자 */
    @Column(nullable = false, length = 100)
    private String logicalName;

    /** 물리명 (예: "user_name") — 최대 100자 */
    @Column(nullable = false, length = 100)
    private String physicalName;

    /** 소속 팀 */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "team_id", nullable = false)
    private Team team;

    /** 연결된 도메인 (nullable — 타입 매핑 없이 이름만 관리 가능) */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "domain_id")
    private Domain domain;

    /**
     * 용어 엔티티를 생성한다.
     *
     * @param logicalName  논리명
     * @param physicalName 물리명
     * @param team         소속 팀
     * @param domain       연결된 도메인 (nullable)
     */
    @Builder
    public Term(String logicalName, String physicalName, Team team, Domain domain) {
        this.logicalName = logicalName;
        this.physicalName = physicalName;
        this.team = team;
        this.domain = domain;
    }
}
