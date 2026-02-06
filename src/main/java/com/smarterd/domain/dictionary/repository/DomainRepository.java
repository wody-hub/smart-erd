package com.smarterd.domain.dictionary.repository;

import com.smarterd.domain.dictionary.entity.Domain;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DomainRepository extends JpaRepository<Domain, Long> {
}
