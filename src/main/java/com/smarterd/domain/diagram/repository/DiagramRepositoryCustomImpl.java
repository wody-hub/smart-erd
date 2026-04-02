package com.smarterd.domain.diagram.repository;

import static com.smarterd.domain.diagram.entity.QDiagram.diagram;

import com.querydsl.core.Tuple;
import com.querydsl.core.types.dsl.BooleanExpression;
import com.querydsl.jpa.impl.JPAQueryFactory;
import com.smarterd.domain.diagram.entity.Diagram;
import com.smarterd.domain.project.entity.Project;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
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
            .where(diagram.id.eq(id).and(diagram.deletedAt.isNull()))
            .fetchOne();
        return Optional.ofNullable(result);
    }

    @Override
    public boolean existsYdocSnapshotById(Long id) {
        final var snapshot = queryFactory
            .select(diagram.ydocSnapshot)
            .from(diagram)
            .where(diagram.id.eq(id).and(diagram.deletedAt.isNull()))
            .fetchOne();
        return snapshot != null && snapshot.length > 0;
    }

    @Override
    public Optional<byte[]> findYdocSnapshotById(Long id) {
        return Optional.ofNullable(
            queryFactory
                .select(diagram.ydocSnapshot)
                .from(diagram)
                .where(diagram.id.eq(id).and(diagram.deletedAt.isNull()))
                .fetchOne()
        );
    }

    @Override
    public long updateYdocSnapshotById(Long id, byte[] snapshot) {
        return queryFactory
            .update(diagram)
            .set(diagram.ydocSnapshot, snapshot)
            .set(diagram.updatedAt, Instant.now())
            .where(diagram.id.eq(id).and(diagram.deletedAt.isNull()))
            .execute();
    }

    @Override
    public Long findContentRevisionForUpdate(Long id) {
        return queryFactory
            .select(diagram.contentRevision)
            .from(diagram)
            .where(diagram.id.eq(id).and(diagram.deletedAt.isNull()))
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
            .where(diagram.id.eq(id).and(diagram.deletedAt.isNull()))
            .execute();
    }

    @Override
    public Optional<SnapshotWithRevision> findYdocSnapshotWithRevisionById(Long id) {
        final Tuple result = queryFactory
            .select(diagram.ydocSnapshot, diagram.snapshotRevision)
            .from(diagram)
            .where(diagram.id.eq(id).and(diagram.deletedAt.isNull()))
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
            .where(diagram.project.eq(project).and(diagram.id.eq(diagramId)).and(diagram.deletedAt.isNull()))
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

    @Override
    public Optional<DiagramBootstrapProjection> findBootstrapByProjectAndId(Project project, Long diagramId) {
        final BooleanExpression hasSnapshotExpr = diagram.ydocSnapshot.isNotNull();
        final BooleanExpression artifactAvailableExpr = diagram.content.isNotNull().and(diagram.content.isNotEmpty());

        final Tuple result = queryFactory
            .select(diagram.pluginId, diagram.contentRevision, diagram.snapshotRevision, hasSnapshotExpr, artifactAvailableExpr)
            .from(diagram)
            .where(diagram.project.eq(project).and(diagram.id.eq(diagramId)).and(diagram.deletedAt.isNull()))
            .fetchOne();
        if (result == null) {
            return Optional.empty();
        }

        final Long contentRevision = result.get(diagram.contentRevision);
        if (contentRevision == null) {
            return Optional.empty();
        }

        return Optional.of(
            new DiagramBootstrapProjection(
                result.get(diagram.pluginId),
                contentRevision,
                result.get(diagram.snapshotRevision),
                Boolean.TRUE.equals(result.get(hasSnapshotExpr)),
                Boolean.TRUE.equals(result.get(artifactAvailableExpr))
            )
        );
    }

    @Override
    public Optional<DiagramBootstrapProjection> findBootstrapById(Long diagramId) {
        final BooleanExpression hasSnapshotExpr = diagram.ydocSnapshot.isNotNull();
        final BooleanExpression artifactAvailableExpr = diagram.content.isNotNull().and(diagram.content.isNotEmpty());

        final Tuple result = queryFactory
            .select(diagram.pluginId, diagram.contentRevision, diagram.snapshotRevision, hasSnapshotExpr, artifactAvailableExpr)
            .from(diagram)
            .where(diagram.id.eq(diagramId).and(diagram.deletedAt.isNull()))
            .fetchOne();
        if (result == null) {
            return Optional.empty();
        }

        final Long contentRevision = result.get(diagram.contentRevision);
        if (contentRevision == null) {
            return Optional.empty();
        }

        return Optional.of(
            new DiagramBootstrapProjection(
                result.get(diagram.pluginId),
                contentRevision,
                result.get(diagram.snapshotRevision),
                Boolean.TRUE.equals(result.get(hasSnapshotExpr)),
                Boolean.TRUE.equals(result.get(artifactAvailableExpr))
            )
        );
    }

    @Override
    public List<DiagramSummaryProjection> findSummariesByProject(Project project) {
        return queryFactory
            .select(
                diagram.id,
                diagram.name,
                diagram.pluginId,
                diagram.dictionarySet.id,
                diagram.dictionarySet.name,
                diagram.templateKey,
                diagram.summaryText,
                diagram.createdAt,
                diagram.updatedAt
            )
            .from(diagram)
            .leftJoin(diagram.dictionarySet)
            .where(diagram.project.eq(project), diagram.deletedAt.isNull())
            .orderBy(diagram.updatedAt.desc())
            .fetch()
            .stream()
            .map((row) -> new DiagramSummaryProjection(
                row.get(diagram.id),
                row.get(diagram.name),
                row.get(diagram.pluginId),
                row.get(diagram.dictionarySet.id),
                row.get(diagram.dictionarySet.name),
                row.get(diagram.templateKey),
                row.get(diagram.summaryText),
                row.get(diagram.createdAt),
                row.get(diagram.updatedAt)
            ))
            .toList();
    }
}
