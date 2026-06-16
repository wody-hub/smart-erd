package com.smarterd.domain.pm.wbs.service;

import com.smarterd.domain.pm.wbs.entity.WbsItem;
import org.springframework.lang.Nullable;

/**
 * WBS parent별 sort order 계산 키.
 *
 * @param parentId 부모 WBS ID
 */
record WbsParentRef(@Nullable Long parentId) {
    /**
     * WBS parent 엔티티에서 parent reference를 생성한다.
     *
     * @param parent 부모 WBS
     * @return parent reference
     */
    static WbsParentRef of(@Nullable WbsItem parent) {
        return new WbsParentRef(parent == null ? null : parent.getId());
    }
}
