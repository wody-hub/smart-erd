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
 * 단어 사전 엔티티.
 *
 * <p>용어를 구성하는 기본 단위의 논리명/물리명 매핑을 정의한다.</p>
 */
@Entity
@Table(name = "words", uniqueConstraints = @UniqueConstraint(columnNames = { "dictionary_set_id", "logical_name" }))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Word extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String logicalName;

    @Column(nullable = false, length = 100)
    private String physicalName;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "team_id", nullable = false)
    private Team team;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "dictionary_set_id")
    private DictionarySet dictionarySet;

    @Column(length = 500)
    private String description;

    @Builder
    public Word(String logicalName, String physicalName, Team team, DictionarySet dictionarySet, String description) {
        this.logicalName = logicalName;
        this.physicalName = physicalName;
        this.team = team;
        this.dictionarySet = dictionarySet;
        this.description = description;
    }

    public void update(String logicalName, String physicalName, String description) {
        this.logicalName = logicalName;
        this.physicalName = physicalName;
        this.description = description;
    }
}
