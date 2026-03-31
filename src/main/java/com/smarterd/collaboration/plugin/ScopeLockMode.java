package com.smarterd.collaboration.plugin;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * generic lock scope 모드.
 */
public enum ScopeLockMode {
    SHARED("shared"),
    EXCLUSIVE("exclusive");

    private final String wireValue;

    ScopeLockMode(String wireValue) {
        this.wireValue = wireValue;
    }

    /**
     * JSON/WS wire value를 반환한다.
     *
     * @return lower-case wire value
     */
    @JsonValue
    public String wireValue() {
        return wireValue;
    }

    /**
     * wire value를 enum으로 변환한다.
     *
     * @param value wire value
     * @return scope lock mode
     */
    @JsonCreator
    public static ScopeLockMode fromWireValue(String value) {
        return switch (value) {
            case "shared" -> SHARED;
            case "exclusive" -> EXCLUSIVE;
            default -> throw new IllegalArgumentException("Unsupported scope lock mode: " + value);
        };
    }
}
