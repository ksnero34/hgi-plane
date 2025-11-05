import type { TCalendarLayouts } from "@plane/types";
import { EStartOfTheWeek } from "@plane/types";

export const MONTHS_LIST: {
  [monthNumber: number]: {
    shortTitle: string;
    title: string;
  };
} = {
  1: {
    shortTitle: "1월",
    title: "1월",
  },
  2: {
    shortTitle: "2월",
    title: "2월",
  },
  3: {
    shortTitle: "3월",
    title: "3월",
  },
  4: {
    shortTitle: "4월",
    title: "4월",
  },
  5: {
    shortTitle: "5월",
    title: "5월",
  },
  6: {
    shortTitle: "6월",
    title: "6월",
  },
  7: {
    shortTitle: "7월",
    title: "7월",
  },
  8: {
    shortTitle: "8월",
    title: "8월",
  },
  9: {
    shortTitle: "9월",
    title: "9월",
  },
  10: {
    shortTitle: "10월",
    title: "10월",
  },
  11: {
    shortTitle: "11월",
    title: "11월",
  },
  12: {
    shortTitle: "12월",
    title: "12월",
  },
};

export const DAYS_LIST: {
  [dayIndex: number]: {
    shortTitle: string;
    title: string;
    value: EStartOfTheWeek;
  };
} = {
  1: {
    shortTitle: "일",
    title: "일요일",
    value: EStartOfTheWeek.SUNDAY,
  },
  2: {
    shortTitle: "월",
    title: "월요일",
    value: EStartOfTheWeek.MONDAY,
  },
  3: {
    shortTitle: "화",
    title: "화요일",
    value: EStartOfTheWeek.TUESDAY,
  },
  4: {
    shortTitle: "수",
    title: "수요일",
    value: EStartOfTheWeek.WEDNESDAY,
  },
  5: {
    shortTitle: "목",
    title: "목요일",
    value: EStartOfTheWeek.THURSDAY,
  },
  6: {
    shortTitle: "금",
    title: "금요일",
    value: EStartOfTheWeek.FRIDAY,
  },
  7: {
    shortTitle: "토",
    title: "토요일",
    value: EStartOfTheWeek.SATURDAY,
  },
};

export const CALENDAR_LAYOUTS: {
  [layout in TCalendarLayouts]: {
    key: TCalendarLayouts;
    title: string;
  };
} = {
  month: {
    key: "month",
    title: "월 레이아웃",
  },
  week: {
    key: "week",
    title: "주 레이아웃",
  },
};
