package com.smarterd.config.persistence.sqlformat;

import com.smarterd.config.persistence.sqlformat.step.ClauseBreakStep;
import com.smarterd.config.persistence.sqlformat.step.CollapseWhitespaceStep;
import com.smarterd.config.persistence.sqlformat.step.InsertLeadingCommaStep;
import com.smarterd.config.persistence.sqlformat.step.NormalizeKeywordsStep;
import com.smarterd.config.persistence.sqlformat.step.SelectLeadingCommaStep;
import com.smarterd.config.persistence.sqlformat.step.UpdateSetLeadingCommaStep;
import java.util.List;
import java.util.Objects;

/**
 * SQL 포맷 파이프라인 팩토리.
 *
 * <p>프로필별로 스텝 조합을 생성한다. 현재는 SCSMS 프로필만 제공하지만
 * 향후 스타일 확장 시 이 팩토리에서 스텝 조합만 추가하면 된다.</p>
 */
public final class SqlFormatPipelineFactory {

    private static final SqlFormatPipeline SCSMS_PIPELINE = new SqlFormatPipeline(
        List.of(
            new CollapseWhitespaceStep(),
            new NormalizeKeywordsStep(),
            new ClauseBreakStep(),
            new SelectLeadingCommaStep(),
            new UpdateSetLeadingCommaStep(),
            new InsertLeadingCommaStep()
        )
    );

    private SqlFormatPipelineFactory() {}

    /**
     * 지정한 프로필에 대응하는 SQL 포맷 파이프라인을 반환한다.
     *
     * @param profile 포맷 프로필
     * @return 프로필에 매핑된 SQL 포맷 파이프라인
     */
    public static SqlFormatPipeline create(SqlFormatProfile profile) {
        return switch (Objects.requireNonNull(profile, "profile must not be null")) {
            // 단계 순서가 의미를 가진다.
            // 1) 공백 정리 -> 2) 키워드 정규화 -> 3) 절 개행 -> 4) 구문별 leading comma 정렬
            case SCSMS -> SCSMS_PIPELINE;
        };
    }
}
