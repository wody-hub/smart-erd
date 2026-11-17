package com.smarterd.collaboration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.smarterd.config.websocket.CollaborationProperties;
import com.smarterd.domain.common.exception.ProtocolTooOldException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

class CollaborationProtocolPolicyTest {

    private final CollaborationProperties properties = new CollaborationProperties();
    private final CollaborationProtocolPolicy policy = new CollaborationProtocolPolicy(properties);

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = { "invalid", "0", "-1", "2147483648", "3.0" })
    void invalidRestVersionsFallBackToOne(String value) {
        assertThat(policy.restVersion(value)).isEqualTo(1);
        policy.requireEditVersion(policy.restVersion(value));
        properties.setMinEditProtocolVersion(3);
        assertThatThrownBy(() -> policy.requireEditVersion(policy.restVersion(value))).isInstanceOf(
            ProtocolTooOldException.class
        );
    }

    @Test
    void minimumIsInclusiveAndDefaultPreservesLegacyClients() {
        policy.requireEditVersion(1);
        properties.setMinEditProtocolVersion(3);
        assertThat(policy.allowsEdit(1)).isFalse();
        assertThat(policy.allowsEdit(2)).isFalse();
        assertThat(policy.allowsEdit(3)).isTrue();
        assertThat(policy.restVersion("3")).isEqualTo(3);
        assertThat(policy.restVersion("4")).isEqualTo(4);
    }
}
