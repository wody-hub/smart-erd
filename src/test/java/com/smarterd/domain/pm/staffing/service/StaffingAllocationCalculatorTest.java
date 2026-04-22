package com.smarterd.domain.pm.staffing.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.smarterd.domain.common.exception.BusinessException;
import com.smarterd.domain.common.message.MessageCode;
import com.smarterd.domain.pm.staffing.entity.ProjectStaffing;
import java.lang.reflect.InvocationTargetException;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class StaffingAllocationCalculatorTest {

    private final StaffingAllocationCalculator calculator = new StaffingAllocationCalculator();

    @Test
    @DisplayName("100% full month calculates 1.00 MM and full monthly cost")
    void calculate_fullMonthAt100Percent() {
        final var result = calculator.calculate(
            LocalDate.parse("2026-04-01"),
            LocalDate.parse("2026-04-30"),
            100,
            10_000_000L
        );

        assertThat(result.totalMm()).isEqualByComparingTo("1.00");
        assertThat(result.cost()).isEqualTo(10_000_000L);
        assertThat(result.monthlyAllocations()).containsExactly(
            new StaffingAllocationCalculator.StaffingMonthlyAllocation("2026-04", new BigDecimal("1.00"))
        );
    }

    @Test
    @DisplayName("50% full month calculates 0.50 MM and half cost")
    void calculate_halfParticipationFullMonth() {
        final var result = calculator.calculate(
            LocalDate.parse("2026-04-01"),
            LocalDate.parse("2026-04-30"),
            50,
            10_000_000L
        );

        assertThat(result.totalMm()).isEqualByComparingTo("0.50");
        assertThat(result.cost()).isEqualTo(5_000_000L);
    }

    @Test
    @DisplayName("partial month proration is based on calendar overlap days")
    void calculate_partialMonth() {
        final var result = calculator.calculate(
            LocalDate.parse("2026-04-16"),
            LocalDate.parse("2026-04-30"),
            100,
            10_000_000L
        );

        assertThat(result.totalMm()).isEqualByComparingTo("0.50");
        assertThat(result.cost()).isEqualTo(5_000_000L);
        assertThat(result.monthlyAllocations()).containsExactly(
            new StaffingAllocationCalculator.StaffingMonthlyAllocation("2026-04", new BigDecimal("0.50"))
        );
    }

    @Test
    @DisplayName("cross-month period sums per-month prorated MM before rounding")
    void calculate_crossMonth() {
        final var result = calculator.calculate(
            LocalDate.parse("2026-04-16"),
            LocalDate.parse("2026-05-15"),
            100,
            10_000_000L
        );

        assertThat(result.totalMm()).isEqualByComparingTo("0.98");
        assertThat(result.cost()).isEqualTo(9_800_000L);
        assertThat(result.monthlyAllocations()).containsExactly(
            new StaffingAllocationCalculator.StaffingMonthlyAllocation("2026-04", new BigDecimal("0.50")),
            new StaffingAllocationCalculator.StaffingMonthlyAllocation("2026-05", new BigDecimal("0.48"))
        );
    }

    @Test
    @DisplayName("leap-year February at 100% calculates exactly 1.00 MM")
    void calculate_leapYearFebruary() {
        final var result = calculator.calculate(
            LocalDate.parse("2028-02-01"),
            LocalDate.parse("2028-02-29"),
            100,
            10_000_000L
        );

        assertThat(result.totalMm()).isEqualByComparingTo("1.00");
        assertThat(result.cost()).isEqualTo(10_000_000L);
    }

    @Test
    @DisplayName("HALF_UP rounds 0.005 MM to 0.01 MM")
    void calculate_roundingHalfUp() {
        final var result = calculator.calculate(
            LocalDate.parse("2026-04-01"),
            LocalDate.parse("2026-04-01"),
            15,
            10_000_000L
        );

        assertThat(result.totalMm()).isEqualByComparingTo("0.01");
        assertThat(result.cost()).isEqualTo(100_000L);
    }

    @Test
    @DisplayName("calculateMonthlyAllocations returns rounded monthly values")
    void calculateMonthlyAllocations_returnsRoundedValues() {
        final var result = calculator.calculateMonthlyAllocations(
            LocalDate.parse("2026-04-16"),
            LocalDate.parse("2026-05-15"),
            100
        );

        assertThat(result).containsExactly(
            new StaffingAllocationCalculator.StaffingMonthlyAllocation("2026-04", new BigDecimal("0.50")),
            new StaffingAllocationCalculator.StaffingMonthlyAllocation("2026-05", new BigDecimal("0.48"))
        );
    }

    @Test
    @DisplayName("monthly rate supports 0 and max cap values")
    void calculate_monthlyRateBoundaries() {
        final var zeroRate = calculator.calculate(
            LocalDate.parse("2026-04-01"),
            LocalDate.parse("2026-04-30"),
            100,
            0L
        );
        final var maxRate = calculator.calculate(
            LocalDate.parse("2026-04-01"),
            LocalDate.parse("2026-04-30"),
            100,
            ProjectStaffing.MAX_MONTHLY_RATE_KRW
        );

        assertThat(zeroRate.cost()).isZero();
        assertThat(maxRate.cost()).isEqualTo(ProjectStaffing.MAX_MONTHLY_RATE_KRW);
    }

    @Test
    @DisplayName("negative or above-cap monthly rates are rejected")
    void calculate_invalidMonthlyRate_throwsBusinessException() {
        assertThatThrownBy(() ->
            calculator.calculate(LocalDate.parse("2026-04-01"), LocalDate.parse("2026-04-30"), 100, -1L)
        )
            .isInstanceOf(BusinessException.class)
            .hasMessage(MessageCode.ERROR_BUSINESS_STAFFING_MONTHLY_RATE_OUT_OF_RANGE.code());

        assertThatThrownBy(() ->
            calculator.calculate(
                LocalDate.parse("2026-04-01"),
                LocalDate.parse("2026-04-30"),
                100,
                ProjectStaffing.MAX_MONTHLY_RATE_KRW + 1L
            )
        )
            .isInstanceOf(BusinessException.class)
            .hasMessage(MessageCode.ERROR_BUSINESS_STAFFING_MONTHLY_RATE_OUT_OF_RANGE.code());
    }

    @Test
    @DisplayName("participation outside 0-100 is rejected")
    void calculate_invalidParticipation_throwsBusinessException() {
        assertThatThrownBy(() ->
            calculator.calculate(LocalDate.parse("2026-04-01"), LocalDate.parse("2026-04-30"), -1, 10_000_000L)
        )
            .isInstanceOf(BusinessException.class)
            .hasMessage(MessageCode.ERROR_BUSINESS_STAFFING_PARTICIPATION_OUT_OF_RANGE.code());

        assertThatThrownBy(() ->
            calculator.calculate(LocalDate.parse("2026-04-01"), LocalDate.parse("2026-04-30"), 101, 10_000_000L)
        )
            .isInstanceOf(BusinessException.class)
            .hasMessage(MessageCode.ERROR_BUSINESS_STAFFING_PARTICIPATION_OUT_OF_RANGE.code());
    }

    @Test
    @DisplayName("start date after end date is rejected")
    void calculate_invalidPeriod_throwsBusinessException() {
        assertThatThrownBy(() ->
            calculator.calculate(LocalDate.parse("2026-04-02"), LocalDate.parse("2026-04-01"), 100, 10_000_000L)
        )
            .isInstanceOf(BusinessException.class)
            .hasMessage(MessageCode.ERROR_BUSINESS_INVALID_STAFFING_PERIOD.code());
    }

    @Test
    @DisplayName("checked long conversion throws cost range error on overflow")
    void checkedLongOverflow_throwsBusinessException() {
        assertThatThrownBy(() -> invokeToCheckedLong(BigDecimal.valueOf(Long.MAX_VALUE).add(BigDecimal.ONE)))
            .isInstanceOf(BusinessException.class)
            .hasMessage(MessageCode.ERROR_BUSINESS_STAFFING_COST_OUT_OF_RANGE.code());
    }

    private long invokeToCheckedLong(BigDecimal value) {
        try {
            final var method = StaffingAllocationCalculator.class.getDeclaredMethod("toCheckedLong", BigDecimal.class);
            method.setAccessible(true);
            return (long) method.invoke(calculator, value);
        } catch (InvocationTargetException ex) {
            if (ex.getTargetException() instanceof RuntimeException runtimeException) {
                throw runtimeException;
            }
            throw new RuntimeException(ex.getTargetException());
        } catch (ReflectiveOperationException ex) {
            throw new RuntimeException(ex);
        }
    }
}
