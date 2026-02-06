package com.smarterd.domain.dictionary.repository;

import com.smarterd.domain.dictionary.entity.Term;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * {@link Term} 엔티티의 데이터 접근 레포지토리.
 */
public interface TermRepository extends JpaRepository<Term, Long> {
}
