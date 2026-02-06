package com.smarterd.domain.dictionary.entity;

import com.smarterd.domain.common.entity.BaseTimeEntity;
import com.smarterd.domain.team.entity.Team;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "domains")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Domain extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String logicalName;

    @Column(nullable = false, length = 50)
    private String physicalType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "team_id", nullable = false)
    private Team team;

    @Builder
    public Domain(String logicalName, String physicalType, Team team) {
        this.logicalName = logicalName;
        this.physicalType = physicalType;
        this.team = team;
    }
}
