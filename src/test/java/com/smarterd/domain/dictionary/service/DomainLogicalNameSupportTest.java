package com.smarterd.domain.dictionary.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class DomainLogicalNameSupportTest {

    @Test
    void format_buildsStandardNameWithTypeAndLength() {
        final var result = DomainLogicalNameSupport.format("명", "varchar", 300, null);

        assertThat(result).isEqualTo("명_V300");
    }

    @Test
    void format_removesWhitespaceFromDomainName() {
        final var result = DomainLogicalNameSupport.format("파일 아이디", "varchar", 50, null);

        assertThat(result).isEqualTo("파일아이디_V50");
    }

    @Test
    void format_appendsScaleWhenPresent() {
        final var result = DomainLogicalNameSupport.format("금액", "decimal", 15, 2);

        assertThat(result).isEqualTo("금액_DECIMAL15_2");
    }

    @Test
    void format_omitsFixedTypeNames() {
        final var result = DomainLogicalNameSupport.format("내용", "text", null, null);

        assertThat(result).isEqualTo("내용");
    }

    @Test
    void format_usesCharCodeForCharLength() {
        final var result = DomainLogicalNameSupport.format("연도", "char", 4, null);

        assertThat(result).isEqualTo("연도_C4");
    }

    @Test
    void format_returnsNullWhenLengthRequiredTypeDoesNotProvideLength() {
        final var result = DomainLogicalNameSupport.format("명", "varchar", null, null);

        assertThat(result).isNull();
    }

    @Test
    void format_doesNotAppendDuplicateSuffix() {
        final var result = DomainLogicalNameSupport.format("명_V500", "varchar", 500, null);

        assertThat(result).isEqualTo("명_V500");
    }

    @Test
    void format_doesNotAppendDuplicateSuffixIgnoringCase() {
        final var result = DomainLogicalNameSupport.format("속성값_v1000", "varchar", 1000, null);

        assertThat(result).isEqualTo("속성값_v1000");
    }

    @Test
    void resolve_fallsBackToExistingLogicalNameWhenDomainNameIsMissing() {
        final var result = DomainLogicalNameSupport.resolve("기존명", null, "varchar", 100, null);

        assertThat(result).isEqualTo("기존명");
    }

    @Test
    void inferDomainName_removesGeneratedSuffix() {
        final var result = DomainLogicalNameSupport.inferDomainName("파일아이디_V50", "varchar", 50, null);

        assertThat(result).isEqualTo("파일아이디");
    }

    @Test
    void inferDomainName_keepsFixedTypeNameAsIs() {
        final var result = DomainLogicalNameSupport.inferDomainName("고유번호", "bigint", null, null);

        assertThat(result).isEqualTo("고유번호");
    }
}
