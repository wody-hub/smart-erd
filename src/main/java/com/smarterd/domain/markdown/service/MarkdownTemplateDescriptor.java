package com.smarterd.domain.markdown.service;

import org.springframework.lang.Nullable;

/**
 * 마크다운 문서 허브/에디터에서 쓰는 템플릿 요약 정보.
 *
 * @param templateKey 템플릿 키
 * @param templateLabel 템플릿 표시 이름
 * @param summaryText 본문 요약
 */
public record MarkdownTemplateDescriptor(
    @Nullable String templateKey,
    @Nullable String templateLabel,
    @Nullable String summaryText
) {}
