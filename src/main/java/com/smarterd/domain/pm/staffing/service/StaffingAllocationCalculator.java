package com.smarterd.domain.pm.staffing.service;

import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.pm.staffing.entity.ProjectStaffing;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * 인력 투입 M/M 및 인건비 계산기.
 */
@Component
public class StaffingAllocationCalculator {

    private static final int DISPLAY_SCALE = 2;
    private static final int INTERNAL_SCALE = 12;
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    public StaffingCalculationResult calculate(
        LocalDate startDate,
        LocalDate endDate,
        int participationRate,
        long monthlyRate
    ) {
        validatePeriod(startDate, endDate);
        validateParticipationRate(participationRate);
        validateMonthlyRate(monthlyRate);

        final var rawMonthlyAllocations = calculateRawMonthlyAllocations(startDate, endDate, participationRate);
        final var monthlyAllocations = rawMonthlyAllocations
            .stream()
            .map((allocation) -> new StaffingMonthlyAllocation(allocation.month(), roundMm(allocation.mm())))
            .toList();

        final var totalMm = roundMm(
            rawMonthlyAllocations.stream().map(RawMonthlyAllocation::mm).reduce(BigDecimal.ZERO, BigDecimal::add)
        );
        final var roundedCost = totalMm.multiply(BigDecimal.valueOf(monthlyRate)).setScale(0, RoundingMode.HALF_UP);

        return new StaffingCalculationResult(totalMm, toCheckedLong(roundedCost), monthlyAllocations);
    }

    public List<StaffingMonthlyAllocation> calculateMonthlyAllocations(
        LocalDate startDate,
        LocalDate endDate,
        int participationRate
    ) {
        validatePeriod(startDate, endDate);
        validateParticipationRate(participationRate);

        return calculateRawMonthlyAllocations(startDate, endDate, participationRate)
            .stream()
            .map((allocation) -> new StaffingMonthlyAllocation(allocation.month(), roundMm(allocation.mm())))
            .toList();
    }

    private List<RawMonthlyAllocation> calculateRawMonthlyAllocations(
        LocalDate startDate,
        LocalDate endDate,
        int participationRate
    ) {
        final var monthlyAllocations = new ArrayList<RawMonthlyAllocation>();
        final var endMonth = YearMonth.from(endDate);

        for (var month = YearMonth.from(startDate); !month.isAfter(endMonth); month = month.plusMonths(1)) {
            final var monthStart = month.atDay(1);
            final var monthEnd = month.atEndOfMonth();
            final var overlapStart = startDate.isAfter(monthStart) ? startDate : monthStart;
            final var overlapEnd = endDate.isBefore(monthEnd) ? endDate : monthEnd;

            if (overlapStart.isAfter(overlapEnd)) {
                continue;
            }

            final var overlapDays = ChronoUnit.DAYS.between(overlapStart, overlapEnd) + 1;
            final var monthRatio = BigDecimal.valueOf(overlapDays)
                .divide(BigDecimal.valueOf(month.lengthOfMonth()), INTERNAL_SCALE, RoundingMode.HALF_UP);
            final var mm = monthRatio
                .multiply(BigDecimal.valueOf(participationRate))
                .divide(HUNDRED, INTERNAL_SCALE, RoundingMode.HALF_UP);
            monthlyAllocations.add(new RawMonthlyAllocation(month.toString(), mm));
        }
        return monthlyAllocations;
    }

    private BigDecimal roundMm(BigDecimal value) {
        return value.setScale(DISPLAY_SCALE, RoundingMode.HALF_UP);
    }

    private long toCheckedLong(BigDecimal value) {
        try {
            return value.longValueExact();
        } catch (ArithmeticException ex) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_STAFFING_COST_OUT_OF_RANGE.code());
        }
    }

    private void validatePeriod(LocalDate startDate, LocalDate endDate) {
        if (startDate.isAfter(endDate)) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_INVALID_STAFFING_PERIOD.code());
        }
    }

    private void validateParticipationRate(int participationRate) {
        if (participationRate < 0 || participationRate > 100) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_STAFFING_PARTICIPATION_OUT_OF_RANGE.code());
        }
    }

    private void validateMonthlyRate(long monthlyRate) {
        if (monthlyRate < 0 || monthlyRate > ProjectStaffing.MAX_MONTHLY_RATE_KRW) {
            throw new BusinessException(MessageCode.ERROR_BUSINESS_STAFFING_MONTHLY_RATE_OUT_OF_RANGE.code());
        }
    }

    public record StaffingCalculationResult(
        BigDecimal totalMm,
        long cost,
        List<StaffingMonthlyAllocation> monthlyAllocations
    ) {}

    public record StaffingMonthlyAllocation(String month, BigDecimal mm) {}

    private record RawMonthlyAllocation(String month, BigDecimal mm) {}
}
