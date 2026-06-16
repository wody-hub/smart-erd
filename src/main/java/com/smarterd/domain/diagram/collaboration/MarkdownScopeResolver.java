package com.smarterd.domain.diagram.collaboration;

import com.smarterd.collaboration.plugin.ScopeLockMode;
import com.smarterd.collaboration.plugin.ScopeRef;
import com.smarterd.collaboration.plugin.ScopeResolver;
import com.smarterd.utils.AppStringUtils;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;

/**
 * markdown document command를 section/document scope로 해석한다.
 *
 * <p>markdown:section-update는 sectionId 기준 section scope로 해석하여
 * 다른 section을 편집하는 사용자 간 scope를 분리한다.</p>
 */
public class MarkdownScopeResolver implements ScopeResolver {

    private static final String SECTION_UPDATE_KEY = "markdown:section-update";
    private static final String BODY_REPLACE_KEY = "markdown:body-replace";
    private static final String FRONTMATTER_UPDATE_KEY = "markdown:frontmatter-update";

    /**
     * command key와 payload를 markdown scope로 해석한다.
     *
     * <p>section-update의 경우 payload의 sectionId를 section scope로 해석하고,
     * 그 외 command(body-replace, frontmatter-update, unknown)는 document/root scope로 해석한다.</p>
     *
     * <p>sectionId가 null이거나 빈 문자열이면 document root scope로 fallback한다.</p>
     * <p>startOffset/endOffset이 음수이거나 역전(start &gt; end)이면 document root scope로 fallback한다.</p>
     *
     * @param commandKey command key (예: "markdown:section-update")
     * @param payload    command payload (sectionId 포함 가능, null 허용)
     * @return affected scope 목록
     */
    @Override
    @NonNull
    public Collection<ScopeRef> resolve(@NonNull String commandKey, @Nullable Map<String, ?> payload) {
        return switch (commandKey) {
            case SECTION_UPDATE_KEY -> {
                if (payload == null) {
                    yield List.of(rootScope());
                }
                final var sectionId = payload.get("sectionId");
                if (!(sectionId instanceof String sid) || AppStringUtils.isBlank(sid)) {
                    yield List.of(rootScope());
                }
                // offset 검증: 음수 또는 역전된 offset은 document root scope로 fallback
                final var startOffset = payload.get("startOffset");
                final var endOffset = payload.get("endOffset");
                if (startOffset instanceof Number start && endOffset instanceof Number end) {
                    if (start.longValue() < 0 || end.longValue() < 0 || start.longValue() > end.longValue()) {
                        yield List.of(rootScope());
                    }
                }
                yield List.of(new ScopeRef("section", sid, ScopeLockMode.EXCLUSIVE));
            }
            case BODY_REPLACE_KEY, FRONTMATTER_UPDATE_KEY -> List.of(rootScope());
            default -> List.of(rootScope());
        };
    }

    /**
     * document/root EXCLUSIVE scope를 반환한다.
     *
     * @return document root scope
     */
    private static ScopeRef rootScope() {
        return new ScopeRef("document", "root", ScopeLockMode.EXCLUSIVE);
    }
}
