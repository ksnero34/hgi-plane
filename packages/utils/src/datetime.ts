import { differenceInDays, format, formatDistanceToNow, isAfter, isEqual, isValid, parseISO } from "date-fns";
import { isNumber } from "lodash-es";
import { ko } from "date-fns/locale";

// Format Date Helpers
/**
 * Returns whether a given date falls within the provided start and end bounds.
 */
export const isDateInRange = (
  date: string | Date | undefined | null,
  startDate: string | null,
  endDate: string | null
): boolean => {
  if (!date) return false;

  const currentDate = date instanceof Date ? date : new Date(date);
  currentDate.setHours(0, 0, 0, 0);

  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    return currentDate >= start && currentDate <= end;
  }

  if (startDate && !endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    return currentDate.getTime() === start.getTime();
  }

  if (!startDate && endDate) {
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    return currentDate.getTime() === end.getTime();
  }

  return false;
};

// Format Date Helpers
/**
 * @returns formatted date in the desired format or platform default format (yyyy-MM-dd)
 * @description Returns date in the formatted format
 * @param {Date | string} date
 * @param {string} formatToken (optional) // default yyyy-MM-dd
 * @example renderFormattedDate("2024-01-01", "MM-dd-yyyy") // 01-01-2024
 * @example renderFormattedDate("2024-01-01") // 2024-01-01
 */
export const renderFormattedDate = (
  date: string | Date | undefined | null,
  formatToken: string = "yyyy-MM-dd"
): string | undefined => {
  const parsedDate = getDate(date);
  if (!parsedDate) return;
  if (!isValid(parsedDate)) return;

  try {
    return format(parsedDate, formatToken);
  } catch (_e) {
    try {
      return format(parsedDate, "yyyy-MM-dd");
    } catch (error) {
      console.error("Error formatting date:", error);
      return undefined;
    }
  }
};

/**
 * @returns formatted date in the format of MMM dd
 * @description Returns date in the formatted format
 * @param {string | Date} date
 * @example renderFormattedDateWithoutYear("2024-01-01") // Jan 01
 */
export const renderFormattedDateWithoutYear = (date: string | Date): string => {
  const parsedDate = getDate(date);
  if (!parsedDate) return "";
  if (!isValid(parsedDate)) return "";
  return format(parsedDate, "MMM dd");
};

/**
 * @returns formatted date in the format of yyyy-MM-dd to be used in payloads
 * @description Returns date in the formatted format to be used in payload
 * @param {Date | string} date
 * @example renderFormattedPayloadDate("Jan 01, 2024") // "2024-01-01"
 */
export const renderFormattedPayloadDate = (date: Date | string | undefined | null): string | undefined => {
  const parsedDate = getDate(date);
  if (!parsedDate) return;
  if (!isValid(parsedDate)) return;
  return format(parsedDate, "yyyy-MM-dd");
};

// Format Time Helpers
/**
 * @returns formatted date in the format of hh:mm a or HH:mm
 * @description Returns time in 12 hour format if requested else 24 hour format
 * @param {string | Date} date
 * @param {"12-hour" | "24-hour"} timeFormat (optional) // default 24 hour
 * @example renderFormattedTime("2024-01-01 13:00:00") // 13:00
 * @example renderFormattedTime("2024-01-01 13:00:00", "12-hour") // 01:00 PM
 */
export const renderFormattedTime = (
  date: string | Date,
  timeFormat: "12-hour" | "24-hour" = "24-hour"
): string => {
  const parsedDate = new Date(date);
  if (!parsedDate) return "";
  if (!isValid(parsedDate)) return "";

  if (timeFormat === "12-hour") {
    return format(parsedDate, "hh:mm a");
  }

  return format(parsedDate, "HH:mm");
};

// Date Difference Helpers
/**
 * @returns total number of days in range
 * @description Returns total number of days in range
 * @param {Date | string} startDate
 * @param {Date | string} endDate
 * @param {boolean} inclusive
 * @example findTotalDaysInRange("2021-01-01", "2021-01-08") // 8
 */
export const findTotalDaysInRange = (
  startDate: Date | string | undefined | null,
  endDate: Date | string | undefined | null,
  inclusive: boolean = true
): number | undefined => {
  const parsedStartDate = getDate(startDate);
  const parsedEndDate = getDate(endDate);
  if (!parsedStartDate || !parsedEndDate) return;
  if (!isValid(parsedStartDate) || !isValid(parsedEndDate)) return 0;

  const diffInDays = differenceInDays(parsedEndDate, parsedStartDate);
  return inclusive ? diffInDays + 1 : diffInDays;
};

/**
 * Add number of days to the provided date and return a resulting new date
 * @param startDate
 * @param numberOfDays
 * @returns Date | undefined
 */
export const addDaysToDate = (startDate: Date | string | undefined | null, numberOfDays: number) => {
  const parsedStartDate = getDate(startDate);
  if (!parsedStartDate) return;

  const newDate = new Date(parsedStartDate);
  newDate.setDate(newDate.getDate() + numberOfDays);
  return newDate;
};

/**
 * @returns number of days left from today
 * @description Returns number of days left from today
 * @param {string | Date} date
 * @param {boolean} inclusive (optional) // default true
 * @example findHowManyDaysLeft("2024-01-01")
 */
export const findHowManyDaysLeft = (
  date: Date | string | undefined | null,
  inclusive: boolean = true
): number | undefined => {
  if (!date) return undefined;
  return findTotalDaysInRange(new Date(), date, inclusive);
};

// Time Difference Helpers
/**
 * @returns formatted distance to now (e.g., "2일 전")
 * @description Returns time passed since the event happened in Korean locale
 * @param {string | number | Date | null} time
 * @example calculateTimeAgo("2023-01-01")
 */
export const calculateTimeAgo = (time: string | number | Date | null): string => {
  if (!time) return "";
  const parsedTime = typeof time === "string" || typeof time === "number" ? parseISO(String(time)) : time;
  if (!parsedTime) return "";
  return formatDistanceToNow(parsedTime, { addSuffix: true, locale: ko });
};

export function calculateTimeAgoShort(date: string | number | Date | null): string {
  if (!date) {
    return "";
  }

  const parsedDate = typeof date === "string" ? parseISO(date) : new Date(date);
  const now = new Date();
  const diffInSeconds = (now.getTime() - parsedDate.getTime()) / 1000;

  if (diffInSeconds < 60) {
    return `${Math.floor(diffInSeconds)}초`;
  }

  const diffInMinutes = diffInSeconds / 60;
  if (diffInMinutes < 60) {
    return `${Math.floor(diffInMinutes)}분`;
  }

  const diffInHours = diffInMinutes / 60;
  if (diffInHours < 24) {
    return `${Math.floor(diffInHours)}시간`;
  }

  const diffInDays = diffInHours / 24;
  if (diffInDays < 30) {
    return `${Math.floor(diffInDays)}일`;
  }

  const diffInMonths = diffInDays / 30;
  if (diffInMonths < 12) {
    return `${Math.floor(diffInMonths)}개월`;
  }

  const diffInYears = diffInMonths / 12;
  return `${Math.floor(diffInYears)}년`;
}

// Date Validation Helpers
/**
 * @returns boolean depending on whether the date is greater than today
 * @description Returns boolean value depending on whether the date is greater than today
 * @param {string} dateStr
 * @example isDateGreaterThanToday("2024-01-01")
 */
export const isDateGreaterThanToday = (dateStr: string): boolean => {
  if (!dateStr) return false;
  const date = parseISO(dateStr);
  const today = new Date();
  if (!isValid(date)) return false;
  return isAfter(date, today);
};

// Week Related Helpers
/**
 * @returns week number of date
 * @description Returns week number of date
 * @param {Date} date
 * @example getWeekNumberOfDate(new Date("2023-09-01")) // 35
 */
export const getWeekNumberOfDate = (date: Date): number => {
  const currentDate = date;
  const startDate = new Date(currentDate.getFullYear(), 0, 1);
  const days = Math.floor((currentDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + 1) / 7);
};

/**
 * @returns boolean depending on whether the dates are equal
 * @description Returns boolean value depending on whether the dates are equal
 * @param date1
 * @param date2
 * @example checkIfDatesAreEqual("2024-01-01", "2024-01-01") // true
 * @example checkIfDatesAreEqual("2024-01-01", "2024-01-02") // false
 */
export const checkIfDatesAreEqual = (
  date1: Date | string | null | undefined,
  date2: Date | string | null | undefined
): boolean => {
  const parsedDate1 = getDate(date1);
  const parsedDate2 = getDate(date2);
  if (!parsedDate1 && !parsedDate2) return true;
  if (!parsedDate1 || !parsedDate2) return false;

  return isEqual(parsedDate1, parsedDate2);
};

/**
 * Returns a Date object from a yyyy-mm-dd string without introducing timezone offsets.
 */
export const getDate = (date: string | Date | undefined | null): Date | undefined => {
  try {
    if (!date || date === "") return;

    if (typeof date !== "string" && !(date instanceof String)) return date;

    const [yearString, monthString, dayString] = date.substring(0, 10).split("-");
    const year = parseInt(yearString);
    const month = parseInt(monthString);
    const day = parseInt(dayString);
    if (!isNumber(year) || !isNumber(month) || !isNumber(day)) return;

    return new Date(year, month - 1, day);
  } catch (_e) {
    return undefined;
  }
};

export const isInDateFormat = (date: string) => {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  return datePattern.test(date);
};

/**
 * returns the date string in ISO format regardless of the timezone in input date string
 * @param dateString
 * @returns
 */
export const convertToISODateString = (dateString: string | undefined) => {
  if (!dateString) return dateString;

  const date = new Date(dateString);
  return date.toISOString();
};

/**
 * returns the date string in epoch regardless of the timezone in input date string
 * @param dateString
 * @returns
 */
export const convertToEpoch = (dateString: string | undefined) => {
  if (!dateString) return dateString;

  const date = new Date(dateString);
  return date.getTime();
};

/**
 * get current Date time in UTC ISO format
 * @returns
 */
export const getCurrentDateTimeInISO = () => {
  const date = new Date();
  return date.toISOString();
};

/**
 * @description converts hours and minutes to minutes
 * @param { number } hours
 * @param { number } minutes
 * @returns { number } minutes
 * @example convertHoursMinutesToMinutes(2, 30) // Output: 150
 */
export const convertHoursMinutesToMinutes = (hours: number, minutes: number): number => hours * 60 + minutes;

/**
 * @description converts minutes to hours and minutes
 * @param { number } mins
 * @returns { number, number } hours and minutes
 * @example convertMinutesToHoursAndMinutes(150) // Output: { hours: 2, minutes: 30 }
 */
export const convertMinutesToHoursAndMinutes = (mins: number): { hours: number; minutes: number } => {
  const hours = Math.floor(mins / 60);
  const minutes = Math.floor(mins % 60);

  return { hours, minutes };
};

/**
 * @description converts minutes to hours and minutes string using Korean units
 * @param { number } totalMinutes
 * @returns { string } e.g. "2시간 10분"
 */
export const convertMinutesToHoursMinutesString = (totalMinutes: number): string => {
  const { hours, minutes } = convertMinutesToHoursAndMinutes(totalMinutes);

  return `${hours ? `${hours}시간 ` : ``}${minutes ? `${minutes}분 ` : ``}`;
};

/**
 * @description calculates the read time for a document using the words count
 * @param {number} wordsCount
 * @returns {number} total number of seconds
 * @example getReadTimeFromWordsCount(400) // Output: 120
 * @example getReadTimeFromWordsCount(100) // Output: 30s
 */
export const getReadTimeFromWordsCount = (wordsCount: number): number => {
  const wordsPerMinute = 200;
  const minutes = wordsCount / wordsPerMinute;
  return minutes * 60;
};

/**
 * @description generates an array of dates between the start and end dates
 * @param startDate
 * @param endDate
 * @returns array of date objects
 */
export const generateDateArray = (startDate: string | Date, endDate: string | Date) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setDate(end.getDate() + 2);

  const dateArray = [];

  while (start <= end) {
    dateArray.push({
      date: new Date(start).toISOString().split("T")[0],
    });
    start.setDate(start.getDate() + 1);
  }

  return dateArray;
};

/**
 * Processes relative date strings like "1_weeks", "2_months" etc and returns a Date
 * @param value The relative date string (e.g., "1_weeks", "2_months")
 * @returns Date object representing the calculated date
 */
export const processRelativeDate = (value: string): Date => {
  const [amountStr, unit] = value.split("_");
  const amount = parseInt(amountStr, 10);
  if (isNaN(amount)) {
    throw new Error(`Invalid relative amount: ${amountStr}`);
  }
  const date = new Date();

  switch (unit) {
    case "days":
      date.setDate(date.getDate() + amount);
      break;
    case "weeks":
      date.setDate(date.getDate() + amount * 7);
      break;
    case "months":
      date.setMonth(date.getMonth() + amount);
      break;
    default:
      throw new Error(`Unsupported time unit: ${unit}`);
  }

  return date;
};

/**
 * Parses a date filter string and returns the comparison type and date
 * @param filterValue The date filter string (e.g., "1_weeks;after;fromnow" or "2024-12-01;after")
 * @returns Object containing the comparison type and target date
 */
export const parseDateFilter = (filterValue: string): { type: "after" | "before"; date: Date } => {
  const parts = filterValue.split(";");
  const dateStr = parts[0];
  const type = parts[1] as "after" | "before";

  let date: Date;
  if (dateStr.includes("_")) {
    date = processRelativeDate(dateStr);
  } else {
    date = new Date(dateStr);
  }

  return { type, date };
};

/**
 * Checks if a date meets the filter criteria
 * @param dateToCheck The date to check
 * @param filterDate The filter date to compare against
 * @param type The type of comparison ('after' or 'before')
 * @returns boolean indicating if the date meets the criteria
 */
export const checkDateCriteria = (
  dateToCheck: Date | null,
  filterDate: Date,
  type: "after" | "before"
): boolean => {
  if (!dateToCheck) return false;

  const checkDate = new Date(dateToCheck);
  const normalizedCheck = new Date(checkDate.setHours(0, 0, 0, 0));
  const normalizedFilter = new Date(filterDate.getTime());
  normalizedFilter.setHours(0, 0, 0, 0);

  return type === "after" ? normalizedCheck >= normalizedFilter : normalizedCheck <= normalizedFilter;
};

/**
 * 날짜 범위를 한국어 표기 규칙에 맞춰 예쁘게 포맷합니다.
 * - 단일 날짜: "2025년 1월 24일"
 * - 같은 해, 같은 달: "2025년 1월 24일 - 28일"
 * - 같은 해, 다른 달: "2025년 1월 24일 - 2월 6일"
 * - 다른 해: "2024년 12월 28일 - 2025년 1월 4일"
 */
export const formatDateRange = (
  parsedStartDate: Date | null | undefined,
  parsedEndDate: Date | null | undefined
): string => {
  if (!parsedStartDate && !parsedEndDate) {
    return "";
  }

  if (parsedStartDate && !parsedEndDate) {
    return format(parsedStartDate, "yyyy년 M월 d일", { locale: ko });
  }

  if (!parsedStartDate && parsedEndDate) {
    return format(parsedEndDate, "yyyy년 M월 d일", { locale: ko });
  }

  if (parsedStartDate && parsedEndDate) {
    const startYear = parsedStartDate.getFullYear();
    const startMonth = parsedStartDate.getMonth();
    const endYear = parsedEndDate.getFullYear();
    const endMonth = parsedEndDate.getMonth();

    const sameYear = startYear === endYear;
    const sameMonth = sameYear && startMonth === endMonth;

    if (sameYear && sameMonth) {
      const yearLabel = `${startYear}년`;
      const monthLabel = `${startMonth + 1}월`;
      const startDay = `${parsedStartDate.getDate()}일`;
      const endDay = `${parsedEndDate.getDate()}일`;
      return `${yearLabel} ${monthLabel} ${startDay} - ${endDay}`;
    }

    if (sameYear) {
      const startFormatted = format(parsedStartDate, "M월 d일", { locale: ko });
      const endFormatted = format(parsedEndDate, "M월 d일", { locale: ko });
      return `${startYear}년 ${startFormatted} - ${endFormatted}`;
    }

    const startFormatted = format(parsedStartDate, "yyyy년 M월 d일", { locale: ko });
    const endFormatted = format(parsedEndDate, "yyyy년 M월 d일", { locale: ko });
    return `${startFormatted} - ${endFormatted}`;
  }

  return "";
};

// Duration Helpers
/**
 * @returns formatted duration in human readable format
 * @description Converts seconds to human readable duration format (e.g., "1 hr 20 min 5 sec")
 * @param {number} seconds - The duration in seconds
 * @example formatDuration(3665) // "1 hr 1 min 5 sec"
 * @example formatDuration(125) // "2 min 5 sec"
 * @example formatDuration(45) // "45 sec"
 */
export const formatDuration = (seconds: number | undefined | null): string => {
  if (!isNumber(seconds) || seconds === null || seconds === undefined || seconds < 0) {
    return "N/A";
  }

  const totalSeconds = Math.round(seconds);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours} hr`);
  }

  if (minutes > 0) {
    parts.push(`${minutes} min`);
  }

  if (remainingSeconds > 0 || parts.length === 0) {
    parts.push(`${remainingSeconds} sec`);
  }

  return parts.join(" ");
};
