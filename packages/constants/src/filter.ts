export enum E_SORT_ORDER {
  ASC = "asc",
  DESC = "desc",
}
export const DATE_AFTER_FILTER_OPTIONS = [
  {
    name: "1주일 이내",
    value: "1_weeks;after;fromnow",
  },
  {
    name: "2주일 이내",
    value: "2_weeks;after;fromnow",
  },
  {
    name: "1개월 이내",
    value: "1_months;after;fromnow",
  },
  {
    name: "2개월 이내",
    value: "2_months;after;fromnow",
  },
];

export const DATE_BEFORE_FILTER_OPTIONS = [
  {
    name: "1 week ago",
    value: "1_weeks;before;fromnow",
  },
  {
    name: "2 weeks ago",
    value: "2_weeks;before;fromnow",
  },
  {
    name: "1 month ago",
    i18n_name: "date_filters.1_month_ago",
    value: "1_months;before;fromnow",
  },
];

export const PROJECT_CREATED_AT_FILTER_OPTIONS = [
  {
    name: "Today",
    value: "today;custom;custom",
  },
  {
    name: "Yesterday",
    value: "yesterday;custom;custom",
  },
  {
    name: "Last 7 days",
    value: "last_7_days;custom;custom",
  },
  {
    name: "Last 30 days",
    value: "last_30_days;custom;custom",
  },
];
