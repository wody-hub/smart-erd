package com.smarterd.domain.pm.wbs.service;

import com.smarterd.domain.common.exception.EntityNotFoundException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.diagram.repository.DiagramRepository;
import com.smarterd.domain.markdown.service.MarkdownDocumentDescriptorService;
import com.smarterd.domain.markdown.service.MarkdownTemplateDescriptor;
import com.smarterd.domain.pm.common.ProjectContextLoader;
import com.smarterd.domain.pm.history.service.WorkItemHistoryService;
import com.smarterd.domain.pm.wbs.entity.WbsDocumentLink;
import com.smarterd.domain.pm.wbs.entity.WbsItem;
import com.smarterd.domain.pm.wbs.repository.WbsDocumentLinkRepository;
import com.smarterd.domain.pm.wbs.repository.WbsItemRepository;
import com.smarterd.domain.project.entity.Project;
import java.time.Instant;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * WBS-문서 연결 및 문서 태그 조회 서비스.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class WbsDocumentService {

    private final ProjectContextLoader projectContextLoader;
    private final WbsItemRepository wbsItemRepository;
    private final WbsDocumentLinkRepository wbsDocumentLinkRepository;
    private final DiagramRepository diagramRepository;
    private final MarkdownDocumentDescriptorService markdownDocumentDescriptorService;
    private final WorkItemHistoryService workItemHistoryService;

    public List<LinkedDocumentResult> getLinkedDocuments(String loginId, Long teamId, Long projectId, Long wbsItemId) {
        final var context = projectContextLoader.load(loginId, teamId, projectId, false);
        final var wbsItem = findWbsItem(context.project(), wbsItemId);
        return wbsDocumentLinkRepository
            .findByWbsItemOrderByCreatedAtDescIdDesc(wbsItem)
            .stream()
            .map((link) -> toLinkedDocumentResult(link, link.getCreatedAt()))
            .toList();
    }

    @Transactional
    public LinkedDocumentResult linkDocument(String loginId, Long teamId, Long projectId, Long wbsItemId, Long documentId) {
        final var context = projectContextLoader.load(loginId, teamId, projectId, true);
        final var wbsItem = findWbsItem(context.project(), wbsItemId);
        final var document = diagramRepository
            .findByProjectAndIdAndDeletedAtIsNull(context.project(), documentId)
            .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_DIAGRAM.code(), documentId));

        final var existing = wbsDocumentLinkRepository.findByWbsItemAndDiagram(wbsItem, document);
        if (existing.isPresent()) {
            return toLinkedDocumentResult(existing.get(), existing.get().getCreatedAt());
        }

        final var link = wbsDocumentLinkRepository.save(WbsDocumentLink.builder().wbsItem(wbsItem).diagram(document).build());
        workItemHistoryService.recordWbsDocumentLinked(
            context.project(),
            wbsItemId,
            document.getId(),
            document.getName(),
            loginId
        );
        return toLinkedDocumentResult(link, link.getCreatedAt());
    }

    @Transactional
    public void unlinkDocument(String loginId, Long teamId, Long projectId, Long wbsItemId, Long documentId) {
        final var context = projectContextLoader.load(loginId, teamId, projectId, true);
        final var wbsItem = findWbsItem(context.project(), wbsItemId);
        final var document = diagramRepository
            .findByProjectAndIdAndDeletedAtIsNull(context.project(), documentId)
            .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_DIAGRAM.code(), documentId));
        final var existing = wbsDocumentLinkRepository.findByWbsItemAndDiagram(wbsItem, document);
        if (existing.isEmpty()) {
            return;
        }

        wbsDocumentLinkRepository.deleteByWbsItemAndDiagram(wbsItem, document);
        workItemHistoryService.recordWbsDocumentUnlinked(
            context.project(),
            wbsItemId,
            document.getId(),
            document.getName(),
            loginId
        );
    }

    public List<DocumentTagResult> getDocumentTags(String loginId, Long teamId, Long projectId) {
        final var context = projectContextLoader.load(loginId, teamId, projectId, false);
        final var tagCounts = new LinkedHashMap<String, Long>();

        loadMarkdownDocuments(context.project())
            .forEach((diagram) -> {
                final var descriptor = markdownDocumentDescriptorService.describe(diagram.getContent());
                descriptor
                    .tags()
                    .forEach((tag) -> tagCounts.merge(tag, 1L, Long::sum));
            });

        return tagCounts
            .entrySet()
            .stream()
            .sorted(Map.Entry.comparingByKey())
            .map((entry) -> new DocumentTagResult(entry.getKey(), entry.getValue()))
            .toList();
    }

    public List<LinkedDocumentResult> getDocumentsByTag(String loginId, Long teamId, Long projectId, String tag) {
        final var context = projectContextLoader.load(loginId, teamId, projectId, false);
        final var normalizedTag = normalizeTag(tag);
        if (normalizedTag == null) {
            return List.of();
        }

        return loadMarkdownDocuments(context.project())
            .stream()
            .map((diagram) -> toLinkedDocumentResult(diagram, null))
            .filter((result) -> result.tags().contains(normalizedTag))
            .sorted(Comparator.comparing(LinkedDocumentResult::updatedAt).reversed().thenComparing(LinkedDocumentResult::id))
            .toList();
    }

    private List<com.smarterd.domain.diagram.entity.Diagram> loadMarkdownDocuments(Project project) {
        return diagramRepository
            .findByProjectAndDeletedAtIsNull(project)
            .stream()
            .filter(com.smarterd.domain.diagram.entity.Diagram::isMarkdownDocument)
            .toList();
    }

    private WbsItem findWbsItem(Project project, Long wbsItemId) {
        return wbsItemRepository
            .findByProjectAndId(project, wbsItemId)
            .orElseThrow(() -> new EntityNotFoundException(MessageCode.ERROR_NOT_FOUND_WBS_ITEM.code(), wbsItemId));
    }

    private LinkedDocumentResult toLinkedDocumentResult(WbsDocumentLink link, @Nullable Instant linkedAt) {
        return toLinkedDocumentResult(link.getDiagram(), linkedAt);
    }

    private LinkedDocumentResult toLinkedDocumentResult(
        com.smarterd.domain.diagram.entity.Diagram document,
        @Nullable Instant linkedAt
    ) {
        final MarkdownTemplateDescriptor descriptor =
            document.isMarkdownDocument()
                ? markdownDocumentDescriptorService.describe(document.getContent())
                : new MarkdownTemplateDescriptor(document.getTemplateKey(), null, document.getSummaryText(), List.of());

        return new LinkedDocumentResult(
            document.getId(),
            document.getName(),
            document.getPluginId(),
            descriptor.templateKey(),
            descriptor.templateLabel(),
            descriptor.summaryText(),
            descriptor.tags(),
            linkedAt,
            document.getCreatedAt(),
            document.getUpdatedAt()
        );
    }

    @Nullable
    private String normalizeTag(String tag) {
        if (tag == null) {
            return null;
        }
        final var normalized = tag.trim().toLowerCase();
        return normalized.isBlank() ? null : normalized;
    }

    public record LinkedDocumentResult(
        Long id,
        String name,
        String pluginId,
        @Nullable String templateKey,
        @Nullable String templateLabel,
        @Nullable String summaryText,
        List<String> tags,
        @Nullable Instant linkedAt,
        Instant createdAt,
        Instant updatedAt
    ) {}

    public record DocumentTagResult(String tag, long documentCount) {}
}
