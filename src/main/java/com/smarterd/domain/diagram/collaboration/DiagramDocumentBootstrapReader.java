package com.smarterd.domain.diagram.collaboration;

import com.smarterd.collaboration.persistence.DocumentBootstrapHeader;
import com.smarterd.collaboration.persistence.DocumentBootstrapReader;
import com.smarterd.domain.common.exception.EntityNotFoundException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.diagram.repository.DiagramRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 다이어그램 문서의 persistence bootstrap header를 읽는다.
 */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class DiagramDocumentBootstrapReader implements DocumentBootstrapReader {

    private final DiagramRepository diagramRepository;

    @Override
    @NonNull
    public DocumentBootstrapHeader loadBootstrapHeader(@NonNull Long documentId) {
        final var projection = diagramRepository
            .findBootstrapById(documentId)
            .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_DIAGRAM.code(), documentId));
        final var defaults = DiagramCollaborationDocumentDefaults.resolve(projection.pluginId());
        final long revision =
            projection.snapshotRevision() != null ? projection.snapshotRevision() : projection.contentRevision();

        return new DocumentBootstrapHeader(
            defaults.pluginSchemaVersion(),
            defaults.snapshotFormatVersion(),
            projection.artifactAvailable() ? defaults.artifactVersion() : null,
            revision,
            projection.hasYdocSnapshot(),
            projection.artifactAvailable()
        );
    }
}
