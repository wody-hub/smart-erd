package com.smarterd.domain.dictionary.repository;

import com.smarterd.domain.dictionary.entity.DictionarySet;
import com.smarterd.domain.dictionary.entity.Word;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * {@link Word} 엔티티의 데이터 접근 레포지토리.
 */
public interface WordRepository extends JpaRepository<Word, Long> {
    List<Word> findByDictionarySet(DictionarySet dictionarySet);

    Page<Word> findByDictionarySet(DictionarySet dictionarySet, Pageable pageable);

    @Query(
        """
        select w
        from Word w
        where w.dictionarySet = :dictionarySet
          and (
            lower(w.logicalName) like lower(concat('%', :keyword, '%'))
            or lower(w.physicalName) like lower(concat('%', :keyword, '%'))
            or lower(coalesce(w.description, '')) like lower(concat('%', :keyword, '%'))
          )
        """
    )
    Page<Word> searchByDictionarySet(
        @Param("dictionarySet") DictionarySet dictionarySet,
        @Param("keyword") String keyword,
        Pageable pageable
    );

    boolean existsByDictionarySetAndLogicalName(DictionarySet dictionarySet, String logicalName);

    boolean existsByDictionarySetAndLogicalNameAndIdNot(DictionarySet dictionarySet, String logicalName, Long id);

    List<Word> findByDictionarySetAndLogicalNameIn(DictionarySet dictionarySet, Collection<String> logicalNames);

    Optional<Word> findByDictionarySetAndLogicalName(DictionarySet dictionarySet, String logicalName);

    void deleteByDictionarySet(DictionarySet dictionarySet);
}
