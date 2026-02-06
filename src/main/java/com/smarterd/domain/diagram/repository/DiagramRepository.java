package com.smarterd.domain.diagram.repository;

import com.smarterd.domain.diagram.entity.Diagram;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DiagramRepository extends JpaRepository<Diagram, Long> {
}
