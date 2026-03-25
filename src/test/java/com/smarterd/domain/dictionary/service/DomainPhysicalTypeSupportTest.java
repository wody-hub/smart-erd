package com.smarterd.domain.dictionary.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class DomainPhysicalTypeSupportTest {

    @Test
    void resolve_parsesLegacyPhysicalTypeWhenStructuredFieldsAreMissing() {
        final var result = DomainPhysicalTypeSupport.resolve("decimal(15,2)", null, null, null);

        assertThat(result.dataType()).isEqualTo("DECIMAL");
        assertThat(result.dataLength()).isEqualTo(15);
        assertThat(result.dataScale()).isEqualTo(2);
        assertThat(result.physicalType()).isEqualTo("DECIMAL(15,2)");
    }

    @Test
    void resolve_prefersStructuredFieldsWhenProvided() {
        final var result = DomainPhysicalTypeSupport.resolve("VARCHAR(255)", "varchar", 300, null);

        assertThat(result.dataType()).isEqualTo("VARCHAR");
        assertThat(result.dataLength()).isEqualTo(300);
        assertThat(result.dataScale()).isNull();
        assertThat(result.physicalType()).isEqualTo("VARCHAR(300)");
    }

    @Test
    void resolve_keepsPlainTypeWithoutLength() {
        final var result = DomainPhysicalTypeSupport.resolve(null, "timestamp", null, null);

        assertThat(result.dataType()).isEqualTo("TIMESTAMP");
        assertThat(result.dataLength()).isNull();
        assertThat(result.dataScale()).isNull();
        assertThat(result.physicalType()).isEqualTo("TIMESTAMP");
    }

    @Test
    void requiresLength_returnsTrueForPrecisionSensitiveTypes() {
        assertThat(DomainPhysicalTypeSupport.requiresLength("varchar")).isTrue();
        assertThat(DomainPhysicalTypeSupport.requiresLength("char")).isTrue();
        assertThat(DomainPhysicalTypeSupport.requiresLength("decimal")).isTrue();
        assertThat(DomainPhysicalTypeSupport.requiresLength("numeric")).isTrue();
        assertThat(DomainPhysicalTypeSupport.requiresLength("bigint")).isFalse();
    }

    @Test
    void isScaleExceedsLength_detectsInvalidScale() {
        assertThat(DomainPhysicalTypeSupport.isScaleExceedsLength(5, 6)).isTrue();
        assertThat(DomainPhysicalTypeSupport.isScaleExceedsLength(5, 5)).isFalse();
        assertThat(DomainPhysicalTypeSupport.isScaleExceedsLength(null, 1)).isFalse();
    }
}
