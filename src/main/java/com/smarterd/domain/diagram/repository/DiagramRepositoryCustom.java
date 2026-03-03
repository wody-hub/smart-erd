package com.smarterd.domain.diagram.repository;

import com.smarterd.domain.diagram.entity.Diagram;
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
}
