package com.smarterd.application.ai;

/**
 * Optional project resource selected by the user before an AI execution.
 *
 * @param type resource type
 * @param id resource id
 */
public record AiSelectedResource(String type, Long id) {}
