package com.smarterd.domain.common.entity;

import jakarta.persistence.Column;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.MappedSuperclass;
import java.time.LocalDateTime;
import lombok.Getter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/**
 * 모든 엔티티의 생성·수정 시각을 자동 관리하는 공통 상위 클래스.
 *
 * <p>Spring Data JPA Auditing과 함께 사용되며, 엔티티가 영속화될 때 {@code createdAt}과 {@code updatedAt}이 자동으로 설정된다.</p>
 *
 * @see org.springframework.data.jpa.domain.support.AuditingEntityListener
 */
@Getter
@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
public abstract class BaseTimeEntity {

    /** 엔티티 최초 생성 시각 (수정 불가) */
    @CreatedDate
    @Column(updatable = false)
    private LocalDateTime createdAt;

    /** 엔티티 마지막 수정 시각 */
    @LastModifiedDate
    private LocalDateTime updatedAt;
}
