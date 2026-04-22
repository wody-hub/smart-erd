import { isDateOrderValid } from '@/lib/format';

export type StaffingActualValidationError =
  | 'actualDatePair'
  | 'actualDateOrder'
  | 'actualParticipation'
  | null;

export interface StaffingActualInput {
  actualStartDate: string;
  actualEndDate: string;
  actualParticipationRate: string;
}

/**
 * 참여율 입력값이 0~100 범위의 정수인지 검증한다.
 *
 * @param value 참여율 숫자 값
 * @returns 유효한 참여율이면 true
 */
export function isValidParticipation(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 100;
}

/**
 * 실적 입력 필드 중 하나라도 값이 있는지 확인한다.
 *
 * @param input 실적 입력값
 * @returns 하나라도 입력되어 있으면 true
 */
export function hasAnyActualInput(input: StaffingActualInput): boolean {
  return (
    input.actualStartDate.trim() !== '' ||
    input.actualEndDate.trim() !== '' ||
    input.actualParticipationRate.trim() !== ''
  );
}

/**
 * 실적 입력 필드의 원자적 입력 규칙을 검증한다.
 * 실적 필드는 전부 비우거나, 기간(시작/종료) + 참여율을 모두 입력해야 한다.
 *
 * @param input 실적 입력값
 * @returns 검증 오류 코드 (없으면 null)
 */
export function validateActualInput(input: StaffingActualInput): StaffingActualValidationError {
  const hasActualStartDate = input.actualStartDate.trim() !== '';
  const hasActualEndDate = input.actualEndDate.trim() !== '';
  const hasActualParticipation = input.actualParticipationRate.trim() !== '';

  if (!hasActualStartDate && !hasActualEndDate && !hasActualParticipation) {
    return null;
  }

  if (!hasActualStartDate || !hasActualEndDate) {
    return 'actualDatePair';
  }

  if (!isDateOrderValid(input.actualStartDate, input.actualEndDate)) {
    return 'actualDateOrder';
  }

  if (!hasActualParticipation) {
    return 'actualParticipation';
  }

  const parsedActualParticipation = Number(input.actualParticipationRate);
  if (!isValidParticipation(parsedActualParticipation)) {
    return 'actualParticipation';
  }

  return null;
}
