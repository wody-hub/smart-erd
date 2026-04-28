package com.smarterd.domain.pm.wbs.entity;

import com.smarterd.domain.common.entity.BaseAuditEntity;
import com.smarterd.domain.diagram.entity.Diagram;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * WBS 항목과 프로젝트 문서 간 연결 엔티티.
 */
@Entity
@Table(name = "wbs_document_links")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class WbsDocumentLink extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "wbs_item_id", nullable = false)
    private WbsItem wbsItem;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "diagram_id", nullable = false)
    private Diagram diagram;

    @Builder
    public WbsDocumentLink(WbsItem wbsItem, Diagram diagram) {
        this.wbsItem = wbsItem;
        this.diagram = diagram;
    }
}
