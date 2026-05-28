package com.smarterd.domain.settings.entity;

import com.smarterd.domain.common.entity.BaseAuditEntity;
import com.smarterd.domain.user.entity.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 사용자별 설정 값을 저장한다.
 *
 * <p>설정 키와 JSON 문자열 값을 분리해 보관하여 새로운 개인화 옵션을 같은 도메인에서
 * 확장할 수 있도록 한다.</p>
 */
@Entity
@Table(
    name = "user_settings",
    uniqueConstraints = {
        @UniqueConstraint(name = "uk_user_settings_user_id_setting_key", columnNames = { "user_id", "setting_key" }),
    },
    indexes = { @Index(name = "idx_user_settings_user_id", columnList = "user_id") }
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UserSetting extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "setting_key", nullable = false, length = 100)
    private String settingKey;

    @Column(name = "setting_value", nullable = false, columnDefinition = "TEXT")
    private String settingValue;

    /**
     * 새 사용자 설정을 생성한다.
     *
     * @param user 설정 소유 사용자
     * @param settingKey 설정 키
     * @param settingValue JSON 직렬화된 설정 값
     */
    public UserSetting(User user, String settingKey, String settingValue) {
        this.user = user;
        this.settingKey = settingKey;
        this.settingValue = settingValue;
    }

    /**
     * 설정 값을 갱신한다.
     *
     * @param settingValue JSON 직렬화된 새 설정 값
     */
    public void updateSettingValue(String settingValue) {
        this.settingValue = settingValue;
    }
}
