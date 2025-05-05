// nivo
import { BarDatum } from "@nivo/bar";
// plane imports
import { ANALYTICS_DATE_KEYS, STATE_GROUPS } from "@plane/constants";
import { IAnalyticsData, IAnalyticsParams, IAnalyticsResponse, TStateGroups } from "@plane/types";
import { EEstimateSystem } from "@plane/types/src/enums";
import { convertMinutesToHoursMinutesString } from "@plane/utils";
// constants
import { MONTHS_LIST } from "@/constants/calendar";
// helpers
import { addSpaceIfCamelCase, capitalizeFirstLetter, generateRandomColor } from "@/helpers/string.helper";

/**
 * 분 단위의 시간 값을 읽기 쉬운 형식으로 변환합니다.
 * estimate_point__value 값이 x-axis인 경우에 사용됩니다.
 * @param value 변환할 분 단위 값 (문자열)
 * @returns 변환된 시간 문자열 (예: "15분", "1시간", "2시간 30분")
 */
export const formatTimeEstimateLabel = (value: string): string => {
  const minutes = parseInt(value, 10);
  if (isNaN(minutes)) return value;
  
  // 60분 미만이면 "n분"
  if (minutes < 60) return `${minutes}분`;
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  // 정확히 n시간이면 "n시간"
  if (remainingMinutes === 0) return `${hours}시간`;
  
  // 그 외에는 "n시간 m분"
  return `${hours}시간 ${remainingMinutes}분`;
};

export const convertResponseToBarGraphData = (
  response: IAnalyticsData | undefined,
  params: IAnalyticsParams,
  estimateType?: EEstimateSystem
): { data: BarDatum[]; xAxisKeys: string[] } => {
  if (!response || !(typeof response === "object") || Object.keys(response).length === 0)
    return { data: [], xAxisKeys: [] };

  const data: BarDatum[] = [];

  let xAxisKeys: string[] = [];
  const yAxisKey = params.y_axis === "issue_count" ? "count" : "estimate";

  Object.keys(response).forEach((key) => {
    const segments: { [key: string]: number } = {};

    if (params.segment) {
      response[key].map((item: any) => {
        segments[item.segment ?? "None"] = item[yAxisKey] ?? 0;

        // store the segment in the xAxisKeys array
        if (!xAxisKeys.includes(item.segment ?? "None")) xAxisKeys.push(item.segment ?? "None");
      });

      // 차원 값 포맷팅 - 추정값이 시간 타입이면 적절한 형식으로 변환
      let formattedKey = key;
      if (params.x_axis === "estimate_point__value" && estimateType === EEstimateSystem.TIME) {
        formattedKey = formatTimeEstimateLabel(key);
      }

      data.push({
        name: ANALYTICS_DATE_KEYS.includes(params.x_axis)
          ? renderMonthAndYear(key)
          : params.x_axis === "priority" || params.x_axis === "state__group"
            ? capitalizeFirstLetter(key)
            : formattedKey,
        ...segments,
      });
    } else {
      xAxisKeys = [yAxisKey];

      const item = response[key][0];

      // 차원 값 포맷팅 - 추정값이 시간 타입이면 적절한 형식으로 변환
      let formattedDimension = item.dimension;
      if (params.x_axis === "estimate_point__value" && estimateType === EEstimateSystem.TIME) {
        formattedDimension = formatTimeEstimateLabel(item.dimension);
      }

      data.push({
        name: ANALYTICS_DATE_KEYS.includes(params.x_axis)
          ? renderMonthAndYear(item.dimension)
          : params.x_axis === "priority" || params.x_axis === "state__group"
            ? capitalizeFirstLetter(item.dimension ?? "None")
            : (formattedDimension ?? "None"),
        [yAxisKey]: item[yAxisKey] ?? 0,
      });
    }
  });

  return { data, xAxisKeys };
};

export const generateBarColor = (
  value: string,
  analytics: IAnalyticsResponse,
  params: IAnalyticsParams,
  type: "x_axis" | "segment"
): string => {
  let color: string | undefined = generateRandomColor(value);

  if (!analytics) return color;

  if (params[type] === "state_id")
    color = analytics?.extras.state_details.find((s) => s.state_id === value)?.state__color;

  if (params[type] === "labels__id")
    color = analytics?.extras.label_details.find((l) => l.labels__id === value)?.labels__color ?? undefined;

  if (params[type] === "state__group") color = STATE_GROUPS[value.toLowerCase() as TStateGroups]?.color ?? undefined;

  if (params[type] === "priority") {
    const priority = value.toLowerCase();

    color =
      priority === "urgent"
        ? "#ef4444"
        : priority === "high"
          ? "#f97316"
          : priority === "medium"
            ? "#eab308"
            : priority === "low"
              ? "#22c55e"
              : "#ced4da";
  }

  return color ?? generateRandomColor(value);
};

export const generateDisplayName = (
  value: string,
  analytics: IAnalyticsResponse,
  params: IAnalyticsParams,
  type: "x_axis" | "segment"
): string => {
  let displayName = addSpaceIfCamelCase(value);

  if (!analytics) return displayName;

  if (params[type] === "assignees__id")
    displayName =
      analytics?.extras.assignee_details.find((a) => a.assignees__id === value)?.assignees__display_name ??
      "No assignee";

  if (params[type] === "issue_cycle__cycle_id")
    displayName =
      analytics?.extras.cycle_details.find((c) => c.issue_cycle__cycle_id === value)?.issue_cycle__cycle__name ??
      "None";

  if (params[type] === "issue_module__module_id")
    displayName =
      analytics?.extras.module_details.find((m) => m.issue_module__module_id === value)?.issue_module__module__name ??
      "None";

  if (params[type] === "labels__id")
    displayName = analytics?.extras.label_details.find((l) => l.labels__id === value)?.labels__name ?? "None";

  if (params[type] === "state_id")
    displayName = analytics?.extras.state_details.find((s) => s.state_id === value)?.state__name ?? "None";

  if (ANALYTICS_DATE_KEYS.includes(params.segment ?? "")) displayName = renderMonthAndYear(value);

  return displayName;
};

export const renderMonthAndYear = (date: string | number | null): string => {
  if (!date || date === "") return "";

  const monthNumber = parseInt(`${date}`.split("-")[1], 10);
  const year = `${date}`.split("-")[0];

  return (MONTHS_LIST[monthNumber]?.shortTitle || "None") + ` ${year ? year : ""}`;
};

export const MAX_CHART_LABEL_LENGTH = 15;
export const renderChartDynamicLabel = (
  label: string,
  length: number = MAX_CHART_LABEL_LENGTH
): { label: string; length: number } => {
  const currentLabel = label.substring(0, length);
  return {
    label: `${label.length > MAX_CHART_LABEL_LENGTH ? `${currentLabel.substring(0, MAX_CHART_LABEL_LENGTH - 3)}...` : currentLabel}`,
    length: currentLabel.length,
  };
};

/**
 * 분석 차트에서 프로젝트 설정에 따라 추정 값을 적절히 포맷팅합니다.
 * @param value 포맷팅할 값
 * @param estimateType 추정 타입 (POINTS, TIME, CATEGORIES)
 * @returns 포맷팅된 문자열
 */
export const formatAnalyticsEstimateValue = (value: number, estimateType?: EEstimateSystem): string | number => {
  if (estimateType === EEstimateSystem.TIME) {
    return convertMinutesToHoursMinutesString(value);
  }
  return value;
};
