package com.smarterd.collaboration.plugin;

import org.springframework.lang.NonNull;

/**
 * generic lock scope 참조.
 *
 * @param kind scope kind
 * @param id scope ID
 * @param mode lock mode
 */
public record ScopeRef(@NonNull String kind, @NonNull String id, @NonNull ScopeLockMode mode) {}
