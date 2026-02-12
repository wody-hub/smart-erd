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
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 팀 내 사전 세트(용어/도메인 묶음) 엔티티.
 */
@Entity
@Table(name = "dictionary_sets", uniqueConstraints = @UniqueConstraint(columnNames = { "team_id", "name" }))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DictionarySet extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 500)
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "team_id", nullable = false)
    private Team team;

    @Column(nullable = false)
    private boolean isDefault;

    @Builder
    public DictionarySet(String name, String description, Team team, boolean isDefault) {
        this.name = name;
        this.description = description;
        this.team = team;
        this.isDefault = isDefault;
    }

    public void update(String name, String description) {
        this.name = name;
        this.description = description;
    }

    public void setDefault(boolean isDefault) {
        this.isDefault = isDefault;
    }
}

