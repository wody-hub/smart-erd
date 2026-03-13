package com.smarterd.domain.common.entity;

import com.smarterd.utils.AppStringUtils;
import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import lombok.Getter;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.LastModifiedBy;

/**
 * 생성·수정 시각과 함께 생성자/수정자(loginId)를 관리하는 공통 상위 클래스.
 *
 * <p>인증된 요청에서는 Spring Data JPA Auditing이 현재 로그인 ID를 자동 기록한다.
 * 인증 없이 엔티티를 생성하는 경로는 {@link #initializeAuditActor(String)}로 초기 작성자를 보강할 수 있다.</p>
 */
@Getter
@MappedSuperclass
public abstract class BaseAuditEntity extends BaseTimeEntity {

    /** 엔티티 최초 생성자 loginId (수정 불가) */
    @CreatedBy
    @Column(name = "created_by", updatable = false, length = 50)
    private String createdBy;

    /** 엔티티 마지막 수정자 loginId */
    @LastModifiedBy
    @Column(name = "updated_by", length = 50)
    private String updatedBy;

    /**
     * 인증 컨텍스트가 없는 생성 경로를 위해 감사 작성자를 초기화한다.
     *
     * @param actorLoginId 작성자 loginId
     */
    public void initializeAuditActor(String actorLoginId) {
        final var normalizedActorLoginId = AppStringUtils.trimToNull(actorLoginId);
        if (normalizedActorLoginId == null) {
            return;
        }
        if (createdBy == null) {
            createdBy = normalizedActorLoginId;
        }
        updatedBy = normalizedActorLoginId;
    }
}
