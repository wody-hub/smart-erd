package com.smarterd.domain.diagram.repository;

import static com.smarterd.domain.diagram.entity.QDiagram.diagram;

import com.querydsl.jpa.impl.JPAQueryFactory;
import com.smarterd.domain.diagram.entity.Diagram;
import java.util.Optional;
import lombok.RequiredArgsConstructor;

/**
 * {@link DiagramRepositoryCustom} QueryDSL 구현체.
 */
@RequiredArgsConstructor
public class DiagramRepositoryCustomImpl implements DiagramRepositoryCustom {

    private final JPAQueryFactory queryFactory;

    @Override
    public Optional<Diagram> findByIdWithProjectAndTeam(Long id) {
        final var result = queryFactory
            .selectFrom(diagram)
            .join(diagram.project)
            .fetchJoin()
            .join(diagram.project.team)
            .fetchJoin()
            .where(diagram.id.eq(id))
            .fetchOne();
        return Optional.ofNullable(result);
    }

    @Override
    public boolean existsYdocSnapshotById(Long id) {
        final var result = queryFactory
            .select(diagram.ydocSnapshot.isNotNull())
            .from(diagram)
            .where(diagram.id.eq(id))
            .fetchOne();
        return Boolean.TRUE.equals(result);
    }

    @Override
    public Optional<byte[]> findYdocSnapshotById(Long id) {
        return Optional.ofNullable(
            queryFactory
                .select(diagram.ydocSnapshot)
                .from(diagram)
                .where(diagram.id.eq(id))
                .fetchOne()
        );
    }

    @Override
    public long updateYdocSnapshotById(Long id, byte[] snapshot) {
        return queryFactory
            .update(diagram)
            .set(diagram.ydocSnapshot, snapshot)
            .where(diagram.id.eq(id))
            .execute();
    }
}
