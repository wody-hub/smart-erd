package com.smarterd.domain.diagram.repository;

import com.smarterd.domain.diagram.entity.Diagram;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * {@link Diagram} 엔티티의 데이터 접근 레포지토리.
 */
public interface DiagramRepository extends JpaRepository<Diagram, Long> {}
