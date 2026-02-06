package com.smarterd.domain.dictionary.repository;

import com.smarterd.domain.dictionary.entity.Term;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TermRepository extends JpaRepository<Term, Long> {
}
