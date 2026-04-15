package com.smarterd.domain.diagram.repository;

import com.smarterd.domain.diagram.entity.Diagram;
import com.smarterd.domain.project.entity.Project;
import java.util.List;
import java.util.Optional;

/**
 * {@link Diagram} QueryDSL 커스텀 쿼리 인터페이스.
 */
public interface DiagramRepositoryCustom {
    /**
     * 다이어그램을 프로젝트·팀과 함께 fetch join으로 조회한다.
     * WebSocket 핸드셰이크에서 LAZY 프록시 문제 없이 팀 소속을 확인하기 위해 사용한다.
     *
     * @param id 다이어그램 ID
     * @return 다이어그램 Optional (프로젝트·팀 즉시 로딩)
     */
    Optional<Diagram> findByIdWithProjectAndTeam(Long id);

    /**
     * 다이어그램에 비어있지 않은 Y.Doc 스냅샷이 존재하는지 확인한다.
     * REST 응답에서 클라이언트의 JSON 마이그레이션 여부를 결정하기 위해 사용한다.
     *
     * @param id 다이어그램 ID
     * @return 비어있지 않은 스냅샷 존재 여부
     */
    boolean existsYdocSnapshotById(Long id);

    /**
     * 다이어그램의 Y.Doc 스냅샷(BYTEA)만 프로젝션 조회한다.
     * 전체 엔티티 로딩 없이 바이너리 스냅샷만 가져와 불필요한 content TEXT 로딩을 방지한다.
     *
     * @param id 다이어그램 ID
     * @return Y.Doc 스냅샷 바이트 배열 Optional
     */
    Optional<byte[]> findYdocSnapshotById(Long id);

    /**
     * 다이어그램의 Y.Doc 스냅샷만 직접 갱신한다.
     * 전체 엔티티 로딩 없이 ydocSnapshot 컬럼만 UPDATE하여 불필요한 content TEXT 로딩을 방지한다.
     *
     * @param id       다이어그램 ID
     * @param snapshot Y.Doc 스냅샷 바이트 배열
     * @return 갱신된 행 수 (0이면 다이어그램 미존재)
     */
    long updateYdocSnapshotById(Long id, byte[] snapshot);

    /**
     * 다이어그램의 contentRevision을 비관적 락(FOR UPDATE)으로 조회한다.
     * snapshot flush 시 동시 content 변경을 방지하기 위해 사용한다.
     *
     * @param id 다이어그램 ID
     * @return contentRevision (없으면 null)
     */
    Long findContentRevisionForUpdate(Long id);

    /**
     * Y.Doc 스냅샷과 snapshotRevision을 함께 갱신한다.
     *
     * @param id               다이어그램 ID
     * @param snapshot         Y.Doc 스냅샷 바이트 배열
     * @param snapshotRevision snapshot 리비전 값
     * @return 갱신된 행 수
     */
    long updateYdocSnapshotAndRevisionById(Long id, byte[] snapshot, long snapshotRevision);

    /**
     * Y.Doc 스냅샷과 snapshotRevision을 함께 프로젝션 조회한다.
     *
     * @param id 다이어그램 ID
     * @return SnapshotWithRevision Optional
     */
    Optional<SnapshotWithRevision> findYdocSnapshotWithRevisionById(Long id);

    /**
     * 프로젝트와 ID로 다이어그램을 조회하면서 스냅샷 존재 여부를 함께 반환한다.
     * 별도 existsYdocSnapshotById 쿼리를 제거하여 1쿼리로 통합한다.
     *
     * @param project   프로젝트 엔티티
     * @param diagramId 다이어그램 ID
     * @return DiagramWithSnapshotFlag Optional
     */
    Optional<DiagramWithSnapshotFlag> findByProjectAndIdWithSnapshotFlag(Project project, Long diagramId);

    /**
     * 다이어그램 bootstrap 메타를 경량 프로젝션으로 조회한다.
     * bootstrap 진입 시 content TEXT 전체 로딩을 피하기 위해 사용한다.
     *
     * @param project 프로젝트 엔티티
     * @param diagramId 다이어그램 ID
     * @return DiagramBootstrapProjection Optional
     */
    Optional<DiagramBootstrapProjection> findBootstrapByProjectAndId(Project project, Long diagramId);

    /**
     * 다이어그램 ID만으로 bootstrap 메타를 경량 프로젝션 조회한다.
     *
     * @param diagramId 다이어그램 ID
     * @return DiagramBootstrapProjection Optional
     */
    Optional<DiagramBootstrapProjection> findBootstrapById(Long diagramId);

    /**
     * 프로젝트의 삭제되지 않은 다이어그램을 목록용 경량 프로젝션으로 조회한다.
     * content, ydoc_snapshot 컬럼을 제외하여 대용량 데이터 로딩을 방지한다.
     *
     * @param project 프로젝트 엔티티
     * @return 목록용 프로젝션 목록
     */
    List<DiagramSummaryProjection> findSummariesByProject(Project project);
}
