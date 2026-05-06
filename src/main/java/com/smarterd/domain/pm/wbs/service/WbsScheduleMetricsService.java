package com.smarterd.domain.pm.wbs.service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;

/**
 * WBS 계획/실적 일정 기반 파생 지표를 계산한다.
 */
@Service
@RequiredArgsConstructor
public class WbsScheduleMetricsService {

    private final Clock clock;

    public WbsScheduleMetricsResult calculate(
        @Nullable LocalDate startDate,
        @Nullable LocalDate endDate,
        @Nullable LocalDate actualStartDate,
        @Nullable LocalDate actualEndDate,
        int progressRate
    ) {
        final var today = LocalDate.now(clock);
        final var plannedProgressRate = calculatePlannedProgressRate(startDate, endDate, today);
        final var progressVarianceRate = plannedProgressRate == null ? null : progressRate - plannedProgressRate;
        final var startVarianceDays = calculateVarianceDays(startDate, actualStartDate);
        final var endVarianceDays = calculateVarianceDays(endDate, actualEndDate);

        return new WbsScheduleMetricsResult(
            plannedProgressRate,
            progressVarianceRate,
            startVarianceDays,
            endVarianceDays
        );
    }

    @Nullable
    private Integer calculatePlannedProgressRate(
        @Nullable LocalDate startDate,
        @Nullable LocalDate endDate,
        LocalDate referenceDate
    ) {
        if (startDate == null || endDate == null) {
            return null;
        }
        if (referenceDate.isBefore(startDate)) {
            return 0;
        }
        if (!referenceDate.isBefore(endDate)) {
            return 100;
        }

        final long totalDays = ChronoUnit.DAYS.between(startDate, endDate) + 1;
        final long elapsedDays = ChronoUnit.DAYS.between(startDate, referenceDate) + 1;
        return (int) Math.round((elapsedDays * 100.0d) / totalDays);
    }

    @Nullable
    private Integer calculateVarianceDays(@Nullable LocalDate plannedDate, @Nullable LocalDate actualDate) {
        if (plannedDate == null || actualDate == null) {
            return null;
        }
        return Math.toIntExact(ChronoUnit.DAYS.between(plannedDate, actualDate));
    }

    public record WbsScheduleMetricsResult(
        @Nullable Integer plannedProgressRate,
        @Nullable Integer progressVarianceRate,
        @Nullable Integer startVarianceDays,
        @Nullable Integer endVarianceDays
    ) {}
}
