package com.smarterd.application.ai.proposal;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * Registry for future concrete AI action executors.
 *
 * <p>Phase 11 intentionally registers no production executors in this package. If
 * a future bean implements {@link AiActionExecutor}, approval will still pass
 * through this registry boundary before any write occurs.</p>
 */
@Component
public class AiActionExecutorRegistry {

    private final Map<String, AiActionExecutor> executors;

    public AiActionExecutorRegistry(List<AiActionExecutor> executors) {
        this.executors =
            executors == null
                ? Map.of()
                : executors
                      .stream()
                      .collect(Collectors.toUnmodifiableMap(AiActionExecutor::actionType, Function.identity()));
    }

    public Optional<AiActionExecutor> find(String actionType) {
        return Optional.ofNullable(executors.get(actionType));
    }
}
