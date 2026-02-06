package com.smarterd.domain.team.entity;

import com.smarterd.domain.common.entity.BaseTimeEntity;
import com.smarterd.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/**
 * 팀 엔티티.
 *
 * <p>프로젝트와 데이터 사전(Domain, Term)을 소유하는 조직 단위이다.
 * 팀 소유자({@code owner})와 구성원 목록({@code members})을 관리한다.</p>
 */
@Entity
@Table(name = "teams")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Team extends BaseTimeEntity {

    /** 팀 고유 식별자 (자동 증가) */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 팀 이름 (최대 100자) */
    @Column(nullable = false, length = 100)
    private String name;

    /** 팀 소유자 */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    /** 팀 구성원 목록 (cascade PERSIST/MERGE, orphanRemoval) */
    @OneToMany(mappedBy = "team", cascade = {CascadeType.PERSIST, CascadeType.MERGE}, orphanRemoval = true)
    private List<TeamMember> members = new ArrayList<>();

    /**
     * 팀 엔티티를 생성한다.
     *
     * @param name  팀 이름
     * @param owner 팀 소유자
     */
    @Builder
    public Team(String name, User owner) {
        this.name = name;
        this.owner = owner;
    }
}
