package com.smarterd.collaboration.plugin;

import org.springframework.lang.NonNull;

/**
 * 플러그인 ID로 collaboration plugin을 조회하는 레지스트리 포트.
 */
public interface CollaborationPluginRegistry {
    /**
     * 플러그인 ID에 해당하는 collaboration plugin을 반환한다.
     *
     * @param pluginId 플러그인 ID
     * @return collaboration plugin
     */
    @NonNull
    BaseCollaborationPlugin require(@NonNull String pluginId);
}
