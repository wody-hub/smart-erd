package com.smarterd.domain.pm.wbs.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class WbsScheduleMetricsServiceTest {

    private final Clock clock = Clock.fixed(Instant.parse("2026-05-06T00:00:00Z"), ZoneOffset.UTC);
    private final WbsScheduleMetricsService service = new WbsScheduleMetricsService(clock);

    @Test
    @DisplayName("calculate - 기준일 기준 계획 진척률과 편차를 계산한다")
    void calculate_returnsPlannedProgressAndVariance() {
        final var result = service.calculate(
            LocalDate.parse("2026-05-01"),
            LocalDate.parse("2026-05-10"),
            LocalDate.parse("2026-05-03"),
            LocalDate.parse("2026-05-12"),
            40
        );

        assertThat(result.plannedProgressRate()).isEqualTo(60);
        assertThat(result.progressVarianceRate()).isEqualTo(-20);
        assertThat(result.startVarianceDays()).isEqualTo(2);
        assertThat(result.endVarianceDays()).isEqualTo(2);
    }

    @Test
    @DisplayName("calculate - 계획 일정이 없으면 계획 진척률과 진척 편차를 비운다")
    void calculate_withoutPlannedDates_returnsNullProgressMetrics() {
        final var result = service.calculate(null, null, null, null, 15);

        assertThat(result.plannedProgressRate()).isNull();
        assertThat(result.progressVarianceRate()).isNull();
        assertThat(result.startVarianceDays()).isNull();
        assertThat(result.endVarianceDays()).isNull();
    }

    @Test
    @DisplayName("calculate - 시작 전과 종료 후 기준일을 0 또는 100으로 clamp 한다")
    void calculate_clampsProgressOutsideRange() {
        final var beforeStart = service.calculate(
            LocalDate.parse("2026-05-08"),
            LocalDate.parse("2026-05-20"),
            null,
            null,
            0
        );
        final var afterEnd = service.calculate(
            LocalDate.parse("2026-04-20"),
            LocalDate.parse("2026-05-01"),
            null,
            null,
            100
        );

        assertThat(beforeStart.plannedProgressRate()).isZero();
        assertThat(afterEnd.plannedProgressRate()).isEqualTo(100);
    }
}
