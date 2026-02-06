package com.smarterd.domain.dictionary.repository;

import com.smarterd.domain.dictionary.entity.Domain;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * {@link Domain} 엔티티의 데이터 접근 레포지토리.
 */
public interface DomainRepository extends JpaRepository<Domain, Long> {}
