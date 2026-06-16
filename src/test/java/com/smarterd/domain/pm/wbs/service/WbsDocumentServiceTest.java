package com.smarterd.domain.pm.wbs.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.smarterd.domain.diagram.entity.Diagram;
import com.smarterd.domain.diagram.repository.DiagramRepository;
import com.smarterd.domain.markdown.service.MarkdownDocumentDescriptorService;
import com.smarterd.domain.pm.common.ProjectContextLoader;
import com.smarterd.domain.pm.common.ProjectContextLoader.ProjectContext;
import com.smarterd.domain.pm.history.service.WorkItemHistoryService;
import com.smarterd.domain.pm.wbs.entity.WbsDocumentLink;
import com.smarterd.domain.pm.wbs.entity.WbsItem;
import com.smarterd.domain.pm.wbs.repository.WbsDocumentLinkRepository;
import com.smarterd.domain.pm.wbs.repository.WbsItemRepository;
import com.smarterd.domain.project.entity.Project;
import com.smarterd.domain.team.entity.Team;
import com.smarterd.domain.user.entity.User;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class WbsDocumentServiceTest {

    @Mock
    private ProjectContextLoader projectContextLoader;

    @Mock
    private WbsItemRepository wbsItemRepository;

    @Mock
    private WbsDocumentLinkRepository wbsDocumentLinkRepository;

    @Mock
    private DiagramRepository diagramRepository;

    @Mock
    private MarkdownDocumentDescriptorService markdownDocumentDescriptorService;

    @Mock
    private WorkItemHistoryService workItemHistoryService;

    @InjectMocks
    private WbsDocumentService wbsDocumentService;

    @Test
    @DisplayName("linkDocument - 같은 프로젝트 문서를 WBS에 연결한다")
    void linkDocument_linksProjectDocument() {
        final var team = createTeam(10L);
        final var project = createProject(20L, team);
        final var wbsItem = createWbsItem(100L, project);
        final var document = createMarkdownDocument(42L, project, "API Spec");
        final var link = WbsDocumentLink.builder().wbsItem(wbsItem).diagram(document).build();
        ReflectionTestUtils.setField(link, "id", 1L);
        ReflectionTestUtils.setField(link, "createdAt", Instant.parse("2026-04-28T01:00:00Z"));

        when(projectContextLoader.load("tester", 10L, 20L, true)).thenReturn(new ProjectContext(team, project));
        when(wbsItemRepository.findByProjectAndId(project, 100L)).thenReturn(Optional.of(wbsItem));
        when(diagramRepository.findByProjectAndIdAndDeletedAtIsNull(project, 42L)).thenReturn(Optional.of(document));
        when(wbsDocumentLinkRepository.findByWbsItemAndDiagram(wbsItem, document)).thenReturn(Optional.empty());
        when(wbsDocumentLinkRepository.save(org.mockito.ArgumentMatchers.any(WbsDocumentLink.class))).thenReturn(link);
        when(markdownDocumentDescriptorService.describe(document.getContent())).thenReturn(
            new com.smarterd.domain.markdown.service.MarkdownTemplateDescriptor(
                "technical-spec",
                "Technical Spec",
                "Describe the goal.",
                List.of("spec")
            )
        );

        final var result = wbsDocumentService.linkDocument("tester", 10L, 20L, 100L, 42L);

        verify(workItemHistoryService).recordWbsDocumentLinked(project, 100L, 42L, "API Spec", "tester");
        assertThat(result.id()).isEqualTo(42L);
        assertThat(result.tags()).containsExactly("spec");
        assertThat(result.linkedAt()).isEqualTo(Instant.parse("2026-04-28T01:00:00Z"));
    }

    @Test
    @DisplayName("getDocumentTags - markdown frontmatter 기준 태그 목록을 집계한다")
    void getDocumentTags_groupsMarkdownTags() {
        final var team = createTeam(10L);
        final var project = createProject(20L, team);
        final var specDoc = createMarkdownDocument(41L, project, "Spec");
        final var releaseDoc = createMarkdownDocument(42L, project, "Release");

        when(projectContextLoader.load("tester", 10L, 20L, false)).thenReturn(new ProjectContext(team, project));
        when(diagramRepository.findByProjectAndDeletedAtIsNull(project)).thenReturn(List.of(specDoc, releaseDoc));
        when(markdownDocumentDescriptorService.describe(specDoc.getContent())).thenReturn(
            new com.smarterd.domain.markdown.service.MarkdownTemplateDescriptor(
                "technical-spec",
                "Technical Spec",
                "Spec summary",
                List.of("spec", "backend")
            )
        );
        when(markdownDocumentDescriptorService.describe(releaseDoc.getContent())).thenReturn(
            new com.smarterd.domain.markdown.service.MarkdownTemplateDescriptor(
                "release-note",
                "Release Note",
                "Release summary",
                List.of("backend")
            )
        );

        final var result = wbsDocumentService.getDocumentTags("tester", 10L, 20L);

        assertThat(result).containsExactly(
            new WbsDocumentService.DocumentTagResult("backend", 2),
            new WbsDocumentService.DocumentTagResult("spec", 1)
        );
    }

    @Test
    @DisplayName("unlinkDocument - 연결이 있으면 삭제를 위임한다")
    void unlinkDocument_deletesLink() {
        final var team = createTeam(10L);
        final var project = createProject(20L, team);
        final var wbsItem = createWbsItem(100L, project);
        final var document = createMarkdownDocument(42L, project, "API Spec");

        when(projectContextLoader.load("tester", 10L, 20L, true)).thenReturn(new ProjectContext(team, project));
        when(wbsItemRepository.findByProjectAndId(project, 100L)).thenReturn(Optional.of(wbsItem));
        when(diagramRepository.findByProjectAndIdAndDeletedAtIsNull(project, 42L)).thenReturn(Optional.of(document));
        when(wbsDocumentLinkRepository.findByWbsItemAndDiagram(wbsItem, document)).thenReturn(
            Optional.of(WbsDocumentLink.builder().wbsItem(wbsItem).diagram(document).build())
        );

        wbsDocumentService.unlinkDocument("tester", 10L, 20L, 100L, 42L);

        verify(wbsDocumentLinkRepository).deleteByWbsItemAndDiagram(wbsItem, document);
        verify(workItemHistoryService).recordWbsDocumentUnlinked(project, 100L, 42L, "API Spec", "tester");
    }

    private Team createTeam(Long id) {
        final var owner = User.builder().loginId("owner").password("hashed").name("Owner").build();
        ReflectionTestUtils.setField(owner, "id", 1L);
        final var team = Team.builder().name("Team").owner(owner).build();
        ReflectionTestUtils.setField(team, "id", id);
        return team;
    }

    private Project createProject(Long id, Team team) {
        final var project = Project.builder().name("Project").description("desc").team(team).build();
        ReflectionTestUtils.setField(project, "id", id);
        return project;
    }

    private WbsItem createWbsItem(Long id, Project project) {
        final var item = WbsItem.builder()
            .project(project)
            .parent(null)
            .name("WBS")
            .depth(0)
            .sortOrder(0)
            .assignee(null)
            .startDate(null)
            .endDate(null)
            .progressRate(0)
            .estimatedMm(null)
            .milestone(null)
            .build();
        ReflectionTestUtils.setField(item, "id", id);
        return item;
    }

    private Diagram createMarkdownDocument(Long id, Project project, String name) {
        final var diagram = Diagram.builder()
            .name(name)
            .pluginId("markdown")
            .project(project)
            .content("---\ntags:\n- spec\n---\n# " + name)
            .dictionarySet(null)
            .build();
        ReflectionTestUtils.setField(diagram, "id", id);
        ReflectionTestUtils.setField(diagram, "createdAt", Instant.parse("2026-04-28T00:00:00Z"));
        ReflectionTestUtils.setField(diagram, "updatedAt", Instant.parse("2026-04-28T01:30:00Z"));
        ReflectionTestUtils.setField(diagram, "templateKey", "technical-spec");
        ReflectionTestUtils.setField(diagram, "summaryText", "Summary");
        return diagram;
    }
}
