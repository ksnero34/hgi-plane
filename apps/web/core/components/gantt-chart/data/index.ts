// types
import type { WeekMonthDataType, ChartDataType, TGanttViews } from "@plane/types";
import { EStartOfTheWeek } from "@plane/types";

// constants
export const generateWeeks = (startOfWeek: EStartOfTheWeek = EStartOfTheWeek.SUNDAY): WeekMonthDataType[] => [
  ...weeks.slice(startOfWeek),
  ...weeks.slice(0, startOfWeek),
];

export const weeks: WeekMonthDataType[] = [
  { key: 0, shortTitle: "일", title: "일요일", abbreviation: "일" },
  { key: 1, shortTitle: "월", title: "월요일", abbreviation: "월" },
  { key: 2, shortTitle: "화", title: "화요일", abbreviation: "화" },
  { key: 3, shortTitle: "수", title: "수요일", abbreviation: "수" },
  { key: 4, shortTitle: "목", title: "목요일", abbreviation: "목" },
  { key: 5, shortTitle: "금", title: "금요일", abbreviation: "금" },
  { key: 6, shortTitle: "토", title: "토요일", abbreviation: "토" },
];

export const months: WeekMonthDataType[] = [
  { key: 0, shortTitle: "1월", title: "1월", abbreviation: "1월" },
  { key: 1, shortTitle: "2월", title: "2월", abbreviation: "2월" },
  { key: 2, shortTitle: "3월", title: "3월", abbreviation: "3월" },
  { key: 3, shortTitle: "4월", title: "4월", abbreviation: "4월" },
  { key: 4, shortTitle: "5월", title: "5월", abbreviation: "5월" },
  { key: 5, shortTitle: "6월", title: "6월", abbreviation: "6월" },
  { key: 6, shortTitle: "7월", title: "7월", abbreviation: "7월" },
  { key: 7, shortTitle: "8월", title: "8월", abbreviation: "8월" },
  { key: 8, shortTitle: "9월", title: "9월", abbreviation: "9월" },
  { key: 9, shortTitle: "10월", title: "10월", abbreviation: "10월" },
  { key: 10, shortTitle: "11월", title: "11월", abbreviation: "11월" },
  { key: 11, shortTitle: "12월", title: "12월", abbreviation: "12월" },
];

export const quarters: WeekMonthDataType[] = [
  { key: 0, shortTitle: "1분기", title: "1분기", abbreviation: "1분기" },
  { key: 1, shortTitle: "2분기", title: "2분기", abbreviation: "2분기" },
  { key: 2, shortTitle: "3분기", title: "3분기", abbreviation: "3분기" },
  { key: 3, shortTitle: "4분기", title: "4분기", abbreviation: "4분기" },
];

export const charCapitalize = (word: string) => `${word.charAt(0).toUpperCase()}${word.substring(1)}`;

export const bindZero = (value: number) => (value > 9 ? `${value}` : `0${value}`);

export const timePreview = (date: Date) => {
  let hours = date.getHours();
  const amPm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;

  let minutes: number | string = date.getMinutes();
  minutes = bindZero(minutes);

  return `${bindZero(hours)}:${minutes} ${amPm}`;
};

export const datePreview = (date: Date, includeTime: boolean = false) => {
  const day = date.getDate();
  let month: number | WeekMonthDataType = date.getMonth();
  month = months[month];
  const year = date.getFullYear();

  return `${charCapitalize(month?.shortTitle)} ${day}, ${year}${includeTime ? `, ${timePreview(date)}` : ``}`;
};

// context data
export const VIEWS_LIST: ChartDataType[] = [
  {
    key: "week",
    i18n_title: "common.week",
    data: {
      startDate: new Date(),
      currentDate: new Date(),
      endDate: new Date(),
      approxFilterRange: 4, // it will preview week dates with weekends highlighted with 1 week limitations ex: title (Wed 1, Thu 2, Fri 3)
      dayWidth: 60,
    },
  },
  {
    key: "month",
    i18n_title: "common.month",
    data: {
      startDate: new Date(),
      currentDate: new Date(),
      endDate: new Date(),
      approxFilterRange: 6, // it will preview monthly all dates with weekends highlighted with no limitations ex: title (1, 2, 3)
      dayWidth: 20,
    },
  },
  {
    key: "quarter",
    i18n_title: "common.quarter",
    data: {
      startDate: new Date(),
      currentDate: new Date(),
      endDate: new Date(),
      approxFilterRange: 24, // it will preview week starting dates all months data and there is 3 months limitation for preview ex: title (2, 9, 16, 23, 30)
      dayWidth: 5,
    },
  },
];

export const currentViewDataWithView = (view: TGanttViews = "month") =>
  VIEWS_LIST.find((_viewData) => _viewData.key === view);
