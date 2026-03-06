package com.smarterd.domain.diagram.repository;

import static com.smarterd.domain.diagram.entity.QDiagram.diagram;

import com.querydsl.core.Tuple;
import com.querydsl.core.types.dsl.BooleanExpression;
import com.querydsl.jpa.impl.JPAQueryFactory;
import com.smarterd.domain.diagram.entity.Diagram;
import com.smarterd.domain.project.entity.Project;
import jakarta.persistence.LockModeType;
import java.time.Instant;
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
        final var snapshot = queryFactory
            .select(diagram.ydocSnapshot)
            .from(diagram)
            .where(diagram.id.eq(id))
            .fetchOne();
        return snapshot != null && snapshot.length > 0;
    }

    @Override
    public Optional<byte[]> findYdocSnapshotById(Long id) {
        return Optional.ofNullable(
            queryFactory.select(diagram.ydocSnapshot).from(diagram).where(diagram.id.eq(id)).fetchOne()
        );
    }

    @Override
    public long updateYdocSnapshotById(Long id, byte[] snapshot) {
        return queryFactory
            .update(diagram)
            .set(diagram.ydocSnapshot, snapshot)
            .set(diagram.updatedAt, Instant.now())
            .where(diagram.id.eq(id))
            .execute();
    }

    @Override
    public Long findContentRevisionForUpdate(Long id) {
        return queryFactory
            .select(diagram.contentRevision)
            .from(diagram)
            .where(diagram.id.eq(id))
            .setLockMode(LockModeType.PESSIMISTIC_WRITE)
            .fetchOne();
    }

    @Override
    public long updateYdocSnapshotAndRevisionById(Long id, byte[] snapshot, long snapshotRevision) {
        return queryFactory
            .update(diagram)
            .set(diagram.ydocSnapshot, snapshot)
            .set(diagram.snapshotRevision, snapshotRevision)
            .set(diagram.snapshotUpdatedAt, Instant.now())
            .set(diagram.updatedAt, Instant.now())
            .where(diagram.id.eq(id))
            .execute();
    }

    @Override
    public Optional<SnapshotWithRevision> findYdocSnapshotWithRevisionById(Long id) {
        final Tuple result = queryFactory
            .select(diagram.ydocSnapshot, diagram.snapshotRevision)
            .from(diagram)
            .where(diagram.id.eq(id))
            .fetchOne();
        if (result == null) {
            return Optional.empty();
        }
        return Optional.of(
            new SnapshotWithRevision(result.get(diagram.ydocSnapshot), result.get(diagram.snapshotRevision))
        );
    }

    @Override
    public Optional<DiagramWithSnapshotFlag> findByProjectAndIdWithSnapshotFlag(Project project, Long diagramId) {
        final BooleanExpression hasSnapshotExpr = diagram.ydocSnapshot.isNotNull();

        final Tuple result = queryFactory
            .select(diagram, hasSnapshotExpr)
            .from(diagram)
            .where(diagram.project.eq(project).and(diagram.id.eq(diagramId)))
            .fetchOne();
        if (result == null) {
            return Optional.empty();
        }

        final Diagram found = result.get(diagram);
        if (found == null) {
            return Optional.empty();
        }

        final var hasSnapshot = Boolean.TRUE.equals(result.get(hasSnapshotExpr));
        return Optional.of(new DiagramWithSnapshotFlag(found, hasSnapshot));
    }
}
