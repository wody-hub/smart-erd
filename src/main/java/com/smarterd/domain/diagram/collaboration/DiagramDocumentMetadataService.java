package com.smarterd.domain.diagram.collaboration;

import com.smarterd.collaboration.metadata.DocumentMetadata;
import com.smarterd.collaboration.metadata.DocumentMetadataService;
import com.smarterd.domain.common.exception.EntityNotFoundException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.diagram.entity.DiagramPluginId;
import com.smarterd.domain.diagram.repository.DiagramRepository;
import com.smarterd.domain.team.entity.TeamMember;
import com.smarterd.domain.team.service.TeamService;
import com.smarterd.domain.user.service.AuthService;
import java.util.LinkedHashSet;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 다이어그램 문서의 collaboration metadata를 제공한다.
 */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class DiagramDocumentMetadataService implements DocumentMetadataService {

    private final DiagramRepository diagramRepository;
    private final AuthService authService;
    private final TeamService teamService;

    @Override
    @NonNull
    public DocumentMetadata loadDocumentMetadata(@NonNull Long documentId, @NonNull String requesterId) {
        final var requester = authService.findUserByLoginId(requesterId);
        final var diagram = diagramRepository
            .findByIdWithProjectAndTeam(documentId)
            .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_DIAGRAM.code(), documentId));
        final var team = diagram.getProject().getTeam();
        teamService.verifyMembership(team, requester);

        final var memberIds = new LinkedHashSet<String>();
        memberIds.add(team.getOwner().getLoginId());
        for (TeamMember member : team.getMembers()) {
            memberIds.add(member.getUser().getLoginId());
        }

        return new DocumentMetadata(
            documentId,
            diagram.getPluginId(),
            DiagramCollaborationDocumentDefaults.ENGINE_ID,
            team.getOwner().getLoginId(),
            memberIds
        );
    }
}
