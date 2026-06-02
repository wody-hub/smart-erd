package com.smarterd.api.ai.dto;

import com.smarterd.application.ai.chat.AiReadContextService;

public record AiChatSourceChipResponse(String projectName, String tool, int count) {
    public static AiChatSourceChipResponse from(AiReadContextService.SourceChip sourceChip) {
        return new AiChatSourceChipResponse(sourceChip.projectName(), sourceChip.tool(), sourceChip.count());
    }
}
