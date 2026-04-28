package com.smarterd.domain.pm.wbs.repository;

import com.smarterd.domain.diagram.entity.Diagram;
import com.smarterd.domain.pm.wbs.entity.WbsDocumentLink;
import com.smarterd.domain.pm.wbs.entity.WbsItem;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * WBS-문서 연결 레포지토리.
 */
public interface WbsDocumentLinkRepository extends JpaRepository<WbsDocumentLink, Long> {
    @EntityGraph(attributePaths = { "diagram", "diagram.dictionarySet" })
    List<WbsDocumentLink> findByWbsItemOrderByCreatedAtDescIdDesc(WbsItem wbsItem);

    Optional<WbsDocumentLink> findByWbsItemAndDiagram(WbsItem wbsItem, Diagram diagram);

    void deleteByWbsItemAndDiagram(WbsItem wbsItem, Diagram diagram);
}
