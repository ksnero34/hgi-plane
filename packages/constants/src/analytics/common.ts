import type { TAnalyticsTabsBase } from "@plane/types";
import { ChartXAxisProperty, ChartYAxisMetric } from "@plane/types";

export interface IInsightField {
  key: string;
  i18nKey: string;
  i18nProps?: {
    entity?: string;
    entityPlural?: string;
    prefix?: string;
    suffix?: string;
    [key: string]: unknown;
  };
}

export const ANALYTICS_INSIGHTS_FIELDS: Record<TAnalyticsTabsBase, IInsightField[]> = {
  overview: [
    {
      key: "total_users",
      i18nKey: "workspace_analytics.total",
      i18nProps: {
        entity: "common.users",
      },
    },
    {
      key: "total_admins",
      i18nKey: "workspace_analytics.total",
      i18nProps: {
        entity: "common.admins",
      },
    },
    {
      key: "total_members",
      i18nKey: "workspace_analytics.total",
      i18nProps: {
        entity: "common.members",
      },
    },
    {
      key: "total_guests",
      i18nKey: "workspace_analytics.total",
      i18nProps: {
        entity: "common.guests",
      },
    },
    {
      key: "total_projects",
      i18nKey: "workspace_analytics.total",
      i18nProps: {
        entity: "common.projects",
      },
    },
    {
      key: "total_work_items",
      i18nKey: "workspace_analytics.total",
      i18nProps: {
        entity: "common.work_items",
      },
    },
    {
      key: "total_cycles",
      i18nKey: "workspace_analytics.total",
      i18nProps: {
        entity: "common.cycles",
      },
    },
    {
      key: "total_intake",
      i18nKey: "workspace_analytics.total",
      i18nProps: {
        entity: "sidebar.intake",
      },
    },
  ],
  "work-items": [
    {
      key: "total_work_items",
      i18nKey: "workspace_analytics.total",
    },
    {
      key: "started_work_items",
      i18nKey: "workspace_analytics.started_work_items",
    },
    {
      key: "backlog_work_items",
      i18nKey: "workspace_analytics.backlog_work_items",
    },
    {
      key: "un_started_work_items",
      i18nKey: "workspace_analytics.un_started_work_items",
    },
    {
      key: "completed_work_items",
      i18nKey: "workspace_analytics.completed_work_items",
    },
  ],
};

export const ANALYTICS_DURATION_FILTER_OPTIONS = [
  {
    name: "Yesterday",
    value: "yesterday",
  },
  {
    name: "Last 7 days",
    value: "last_7_days",
  },
  {
    name: "Last 30 days",
    value: "last_30_days",
  },
  {
    name: "Last 3 months",
    value: "last_3_months",
  },
];

export const ANALYTICS_X_AXIS_VALUES: { value: ChartXAxisProperty; label: string }[] = [
  {
    value: ChartXAxisProperty.STATES,
    label: "상태 이름",
  },
  {
    value: ChartXAxisProperty.STATE_GROUPS,
    label: "상태 그룹",
  },
  {
    value: ChartXAxisProperty.PRIORITY,
    label: "우선순위",
  },
  {
    value: ChartXAxisProperty.LABELS,
    label: "라벨",
  },
  {
    value: ChartXAxisProperty.ASSIGNEES,
    label: "담당자",
  },
  {
    value: ChartXAxisProperty.ESTIMATE_POINTS,
    label: "추정값 (포인트/시간)",
  },
  {
    value: ChartXAxisProperty.CYCLES,
    label: "주기",
  },
  {
    value: ChartXAxisProperty.MODULES,
    label: "모듈",
  },
  {
    value: ChartXAxisProperty.COMPLETED_AT,
    label: "완료 날짜",
  },
  {
    value: ChartXAxisProperty.TARGET_DATE,
    label: "마감 날짜",
  },
  {
    value: ChartXAxisProperty.START_DATE,
    label: "시작 날짜",
  },
  {
    value: ChartXAxisProperty.CREATED_AT,
    label: "생성 날짜",
  },
];

export const ANALYTICS_Y_AXIS_VALUES: { value: ChartYAxisMetric; label: string }[] = [
  {
    value: ChartYAxisMetric.WORK_ITEM_COUNT,
    label: "작업 항목 수",
  },
  {
    value: ChartYAxisMetric.ESTIMATE_POINT_COUNT,
    label: "추정값 (포인트/시간)",
  },
  {
    value: ChartYAxisMetric.EPIC_WORK_ITEM_COUNT,
    label: "Epic",
  },
  {
    value: ChartYAxisMetric.EPIC_WORK_ITEM_COUNT,
    label: "Epic",
  },
];

export const ANALYTICS_V2_DATE_KEYS = ["completed_at", "target_date", "start_date", "created_at"];
