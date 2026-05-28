package com.smarterd.domain.settings.repository;

import com.smarterd.domain.settings.entity.UserSetting;
import com.smarterd.domain.user.entity.User;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * {@link UserSetting} 저장소.
 */
public interface UserSettingRepository extends JpaRepository<UserSetting, Long> {
    /**
     * 사용자와 설정 키로 설정을 조회한다.
     *
     * @param user 사용자
     * @param settingKey 설정 키
     * @return 사용자 설정
     */
    Optional<UserSetting> findByUserAndSettingKey(User user, String settingKey);

    /**
     * 사용자 설정을 PostgreSQL upsert로 저장한다.
     *
     * <p>동일 사용자/키 조합의 동시 저장 요청이 와도 단일 SQL 문장으로 insert/update를 해결해
     * unique constraint 경쟁 조건을 제거한다.</p>
     *
     * @param userId 설정 소유 사용자 ID
     * @param settingKey 설정 키
     * @param settingValue JSON 직렬화된 설정 값
     * @param actorLoginId 감사 작성자 loginId
     * @return 영향받은 행 수
     */
    @Modifying
    @Query(
        value = """
        insert into user_settings (
            user_id,
            setting_key,
            setting_value,
            created_at,
            updated_at,
            created_by,
            updated_by
        )
        values (
            :userId,
            :settingKey,
            :settingValue,
            current_timestamp,
            current_timestamp,
            :actorLoginId,
            :actorLoginId
        )
        on conflict (user_id, setting_key)
        do update
        set setting_value = excluded.setting_value,
            updated_at = current_timestamp,
            updated_by = excluded.updated_by
        """,
        nativeQuery = true
    )
    int upsertSetting(
        @Param("userId") Long userId,
        @Param("settingKey") String settingKey,
        @Param("settingValue") String settingValue,
        @Param("actorLoginId") String actorLoginId
    );
}
