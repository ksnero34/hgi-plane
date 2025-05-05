// types
import { TXAxisValues, TYAxisValues } from "@plane/types";

export const ANALYTICS_TABS = [
  {
    key: "scope_and_demand",
    i18n_title: "workspace_analytics.tabs.scope_and_demand",
  },
  { key: "custom", i18n_title: "workspace_analytics.tabs.custom" },
];

export const ANALYTICS_X_AXIS_VALUES: { value: TXAxisValues; label: string }[] =
  [
    {
      value: "state_id",
      label: "상태값",
    },
    {
      value: "state__group",
      label: "상태 그룹",
    },
    {
      value: "priority",
      label: "우선 순위",
    },
    {
      value: "labels__id",
      label: "라벨",
    },
    {
      value: "assignees__id",
      label: "담당자",
    },
    {
      value: "estimate_point__value",
      label: "추정 포인트",
    },
    {
      value: "issue_cycle__cycle_id",
      label: "주기",
    },
    {
      value: "issue_module__module_id",
      label: "모듈",
    },
    {
      value: "completed_at",
      label: "완료 날짜",
    },
    {
      value: "target_date",
      label: "마감 날짜",
    },
    {
      value: "start_date",
      label: "시작 날짜",
    },
    {
      value: "created_at",
      label: "생성 날짜",
    },
  ];

export const ANALYTICS_Y_AXIS_VALUES: { value: TYAxisValues; label: string }[] =
  [
    {
      value: "issue_count",
      label: "작업 항목 수",
    },
    {
      value: "estimate",
      label: "추정값 (포인트/시간)",
    },
  ];

export const ANALYTICS_DATE_KEYS = [
  "completed_at",
  "target_date",
  "start_date",
  "created_at",
];
