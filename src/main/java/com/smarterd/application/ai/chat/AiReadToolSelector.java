package com.smarterd.application.ai.chat;

import com.smarterd.utils.AppStringUtils;
import java.util.LinkedHashSet;
import java.util.Set;
import org.springframework.lang.Nullable;

final class AiReadToolSelector {

    private AiReadToolSelector() {}

    static Set<AiReadContextService.ReadTool> selectTools(@Nullable String question) {
        final var text = AppStringUtils.lowerCaseToEmpty(question);
        final var tools = new LinkedHashSet<AiReadContextService.ReadTool>();
        if (containsAny(text, "overview", "summary", "project", "business", "개요", "사업", "프로젝트")) {
            tools.add(AiReadContextService.ReadTool.OVERVIEW);
        }
        if (containsAny(text, "wbs", "work", "작업", "지연", "미완료", "진척", "담당")) {
            tools.add(AiReadContextService.ReadTool.WBS);
        }
        if (containsAny(text, "milestone", "schedule", "마일스톤", "일정")) {
            tools.add(AiReadContextService.ReadTool.MILESTONES);
        }
        if (containsAny(text, "issue", "risk", "이슈", "리스크")) {
            tools.add(AiReadContextService.ReadTool.ISSUES);
        }
        if (containsAny(text, "todo", "to-do", "할 일", "해야 할", "담당", "미완료")) {
            tools.add(AiReadContextService.ReadTool.TODO);
        }
        if (containsAny(text, "history", "comment", "activity", "히스토리", "코멘트", "댓글", "이력")) {
            tools.add(AiReadContextService.ReadTool.HISTORY);
        }
        if (tools.isEmpty()) {
            tools.add(AiReadContextService.ReadTool.OVERVIEW);
        }
        return Set.copyOf(tools);
    }

    static boolean wantsDetail(@Nullable String question) {
        final var text = AppStringUtils.lowerCaseToEmpty(question);
        return containsAny(text, "detail", "list", "자세", "상세", "목록");
    }

    /**
     * Checks whether text contains at least one keyword.
     *
     * @param text normalized text
     * @param needles keywords to match
     * @return true when any keyword is present
     */
    private static boolean containsAny(String text, String... needles) {
        for (final var needle : needles) {
            if (text.contains(needle)) {
                return true;
            }
        }
        return false;
    }
}
