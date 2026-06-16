package com.smarterd.application.ai.chat;

public record AiChatErrorView(String code, String message, boolean retryable) {}
