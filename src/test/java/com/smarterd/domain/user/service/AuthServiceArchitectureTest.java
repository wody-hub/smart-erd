package com.smarterd.domain.user.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

class AuthServiceArchitectureTest {

    @Test
    void publicServiceMethodsDoNotExposeApiLayerTypes() {
        final var exposedTypeNames = Arrays.stream(AuthService.class.getDeclaredMethods())
            .filter((method) -> !method.isSynthetic())
            .flatMap(this::exposedTypes)
            .map(Class::getName)
            .filter((typeName) -> typeName.startsWith("com.smarterd.api."))
            .toList();

        assertThat(exposedTypeNames).isEmpty();
    }

    private Stream<Class<?>> exposedTypes(Method method) {
        return Stream.concat(Stream.of(method.getReturnType()), Arrays.stream(method.getParameterTypes()));
    }
}
