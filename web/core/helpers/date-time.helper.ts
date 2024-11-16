import { differenceInDays, format, formatDistanceToNow, isAfter, isEqual, isValid, parseISO } from "date-fns";
import isNumber from "lodash/isNumber";

/**
 * @description 주어진 날짜가 시작일과 종료일 사이에 있는지 확인
 * @param date 확인할 날짜
 * @param startDate 시작일 (null 가능)
 * @param endDate 종료일 (null 가능)
 * @returns {boolean} 날짜가 범위 안에 있으면 true
 */
export const isDateInRange = (date: Date | string, startDate: string | null, endDate: string | null): boolean => {
  const currentDate = new Date(date);
  currentDate.setHours(0, 0, 0, 0);

  // start_date와 target_date가 모두 있는 경우
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    return currentDate >= start && currentDate <= end;
  }

  // start_date만 있는 경우
  if (startDate && !endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    return currentDate.getTime() === start.getTime();
  }

  // target_date만 있는 경우
  if (!startDate && endDate) {
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    return currentDate.getTime() === end.getTime();
  }

  return false;
}; 