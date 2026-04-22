package com.smarterd.config.support;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * UTC 기준 {@link Clock} 빈을 등록한다.
 *
 * <p>서비스에서 {@code LocalDate.now(clock)}으로 사용하여 테스트 시 시간을 제어할 수 있도록 한다.</p>
 */
@Configuration
public class ClockConfig {

    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }
}
