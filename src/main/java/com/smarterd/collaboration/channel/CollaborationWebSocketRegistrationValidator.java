package com.smarterd.collaboration.channel;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * 협업 WebSocket handler binding과 endpoint support의 등록 완전성을 검증한다.
 */
@Component
public class CollaborationWebSocketRegistrationValidator {

    /**
     * 기본 생성자.
     *
     * @param webSocketBindings 등록된 WebSocket 바인딩 목록
     * @param endpointSupports 등록된 endpoint support 목록
     */
    public CollaborationWebSocketRegistrationValidator(
        List<CollaborationWebSocketBinding> webSocketBindings,
        List<CollaborationEndpointSupport> endpointSupports
    ) {
        final var bindingsByPattern = indexBindings(webSocketBindings);
        final var supportsByPattern = indexSupports(endpointSupports);
        final Set<String> bindingPatterns = bindingsByPattern.keySet();
        final Set<String> supportPatterns = supportsByPattern.keySet();
        if (!bindingPatterns.equals(supportPatterns)) {
            throw new IllegalStateException(
                "협업 WebSocket binding/support 등록 패턴이 일치하지 않음. "
                    + "bindings=" + bindingPatterns
                    + ", supports=" + supportPatterns
            );
        }
    }

    private Map<String, CollaborationWebSocketBinding> indexBindings(List<CollaborationWebSocketBinding> bindings) {
        final var resolved = new LinkedHashMap<String, CollaborationWebSocketBinding>();
        for (final var binding : bindings) {
            final var previous = resolved.putIfAbsent(binding.websocketHandlerPattern(), binding);
            if (previous != null) {
                throw new IllegalStateException(
                    "중복된 협업 WebSocket binding 패턴: " + binding.websocketHandlerPattern()
                );
            }
        }
        return Map.copyOf(resolved);
    }

    private Map<String, CollaborationEndpointSupport> indexSupports(List<CollaborationEndpointSupport> supports) {
        final var resolved = new LinkedHashMap<String, CollaborationEndpointSupport>();
        for (final var support : supports) {
            final var previous = resolved.putIfAbsent(support.websocketHandlerPattern(), support);
            if (previous != null) {
                throw new IllegalStateException(
                    "중복된 협업 WebSocket endpoint support 패턴: " + support.websocketHandlerPattern()
                );
            }
        }
        return Map.copyOf(resolved);
    }
}
