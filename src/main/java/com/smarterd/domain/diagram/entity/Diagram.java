package com.smarterd.domain.diagram.entity;

import com.smarterd.domain.common.entity.BaseAuditEntity;
import com.smarterd.domain.dictionary.entity.DictionarySet;
import com.smarterd.domain.project.entity.Project;
import jakarta.persistence.Basic;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Objects;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 다이어그램 엔티티.
 *
 * <p>프로젝트({@link Project}) 소속의 ERD 다이어그램을 나타낸다.
 * {@code content} 필드에 React Flow 노드·엣지 JSON을 직렬화하여 TEXT로 저장한다.</p>
 *
 * @see com.smarterd.domain.project.entity.Project
 */
@Entity
@Table(name = "diagrams")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Diagram extends BaseAuditEntity {

    /** 다이어그램 고유 식별자 (자동 증가) */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 다이어그램 이름 (최대 100자) */
    @Column(nullable = false, length = 100)
    private String name;

    /** 문서 플러그인 ID */
    @Column(name = "plugin_id", length = 32, columnDefinition = "VARCHAR(32) DEFAULT 'erd'")
    private String pluginId = DiagramPluginId.ERD.value();

    /** 소속 프로젝트 */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    /** 적용된 사전 세트 */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "dictionary_set_id")
    private DictionarySet dictionarySet;

    /** 직렬화된 React Flow JSON (노드 + 엣지) */
    @Column(columnDefinition = "TEXT")
    private String content;

    // TODO: Yjs 안정화 후 content 필드는 export 전용으로 전환, ydocSnapshot이 단일 소스가 되는 마이그레이션 전략 수립 필요
    /** Yjs CRDT 문서 스냅샷 (바이너리, BYTEA) */
    @Basic(fetch = FetchType.LAZY)
    @Column(columnDefinition = "BYTEA")
    @Getter(AccessLevel.NONE)
    private byte[] ydocSnapshot;

    /** content 리비전 — content 변경 시마다 증가 */
    @Column(name = "content_revision", nullable = false, columnDefinition = "BIGINT DEFAULT 1")
    private long contentRevision = 1L;

    /** snapshot 리비전 — snapshot flush 시 당시 contentRevision 값으로 설정 */
    @Column(name = "snapshot_revision")
    private Long snapshotRevision;

    /** snapshot 저장 시각 */
    @Column(name = "snapshot_updated_at", columnDefinition = "TIMESTAMP WITH TIME ZONE")
    private Instant snapshotUpdatedAt;

    /** markdown 템플릿 키 (ERD 문서는 null) */
    @Column(name = "template_key", length = 64)
    private String templateKey;

    /** markdown 본문 요약 텍스트 (ERD 문서는 null) */
    @Column(name = "summary_text", length = 200)
    private String summaryText;

    /** 논리 삭제 시각 */
    @Column(name = "deleted_at", columnDefinition = "TIMESTAMP WITH TIME ZONE")
    private Instant deletedAt;

    /** 논리 삭제한 사용자 로그인 ID */
    @Column(name = "deleted_by", length = 50)
    private String deletedBy;

    /**
     * 다이어그램 엔티티를 생성한다.
     *
     * @param name    다이어그램 이름
     * @param project 소속 프로젝트
     * @param content       직렬화된 React Flow JSON
     * @param dictionarySet 적용 사전 세트
     */
    @Builder
    public Diagram(String name, String pluginId, Project project, String content, DictionarySet dictionarySet) {
        this.name = name;
        this.pluginId = Objects.requireNonNullElse(pluginId, DiagramPluginId.ERD.value());
        this.project = project;
        this.content = content;
        this.dictionarySet = dictionarySet;
    }

    /**
     * 다이어그램 이름을 변경한다.
     *
     * @param name 새로운 다이어그램 이름
     */
    public void rename(String name) {
        this.name = name;
    }

    public void changeDictionarySet(DictionarySet dictionarySet) {
        this.dictionarySet = dictionarySet;
    }

    public String getPluginId() {
        return Objects.requireNonNullElse(pluginId, DiagramPluginId.ERD.value());
    }

    public boolean isMarkdownDocument() {
        return DiagramPluginId.MARKDOWN.value().equals(getPluginId());
    }

    /**
     * markdown 문서 허브 요약 정보를 갱신한다.
     *
     * @param templateKey 템플릿 키
     * @param summaryText 본문 요약 텍스트
     */
    public void updateSummary(String templateKey, String summaryText) {
        this.templateKey = templateKey;
        this.summaryText = summaryText;
    }

    /**
     * 다이어그램의 콘텐츠를 갱신한다.
     *
     * @param content 새로운 React Flow JSON 문자열
     */
    public void updateContent(String content) {
        this.content = content;
        incrementContentRevision();
        nullifySnapshot();
    }

    /**
     * Y.Doc 스냅샷을 반환한다.
     *
     * <p>JPA 엔티티 특성상 영속성 컨텍스트가 배열 참조를 관리하므로
     * 방어적 복사를 수행하지 않고 직접 참조를 반환한다.</p>
     *
     * @return Y.Doc 바이너리 스냅샷 (null 가능)
     */
    @SuppressWarnings("java:S2384")
    public byte[] getYdocSnapshot() {
        return ydocSnapshot;
    }

    /**
     * Y.Doc 스냅샷을 갱신한다.
     *
     * <p>JPA 엔티티 특성상 영속성 컨텍스트가 배열 참조를 관리하므로
     * 방어적 복사를 수행하지 않고 직접 참조를 저장한다.</p>
     *
     * @param ydocSnapshot Y.Doc 바이너리 스냅샷
     */
    @SuppressWarnings("java:S2384")
    public void updateYdocSnapshot(byte[] ydocSnapshot) {
        this.ydocSnapshot = ydocSnapshot;
    }

    /**
     * content 리비전을 1 증가시킨다.
     */
    public void incrementContentRevision() {
        this.contentRevision++;
    }

    /**
     * snapshot 리비전을 현재 contentRevision으로 동기화한다.
     *
     * @param contentRevisionAtFlush flush 시점의 contentRevision 값
     */
    public void syncSnapshotRevision(long contentRevisionAtFlush) {
        this.snapshotRevision = contentRevisionAtFlush;
        this.snapshotUpdatedAt = Instant.now();
    }

    /**
     * snapshot 관련 필드를 모두 무효화한다.
     * 비-Yjs 저장 또는 사전 세트 변경 시 호출한다.
     */
    public void nullifySnapshot() {
        this.ydocSnapshot = null;
        this.snapshotRevision = null;
        this.snapshotUpdatedAt = null;
    }

    /**
     * 다이어그램을 논리 삭제한다.
     *
     * @param loginId 삭제 수행자 로그인 ID
     */
    public void softDelete(String loginId) {
        this.deletedAt = Instant.now();
        this.deletedBy = loginId;
    }

    /**
     * 논리 삭제 여부를 반환한다.
     *
     * @return 삭제 상태
     */
    public boolean isDeleted() {
        return this.deletedAt != null;
    }
}
