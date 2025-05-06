"use client";

import { BarDatum } from "@nivo/bar";
// plane package imports
import { ANALYTICS_X_AXIS_VALUES, ANALYTICS_Y_AXIS_VALUES } from "@plane/constants";
import { IAnalyticsParams, IAnalyticsResponse, TIssuePriorities } from "@plane/types";
import { PriorityIcon, Tooltip } from "@plane/ui";
// hooks
import { useProjectEstimates } from "@/hooks/store";
import { EEstimateSystem } from "@plane/types/src/enums";
// helpers
import { formatAnalyticsEstimateValue, generateBarColor, generateDisplayName, renderChartDynamicLabel } from "@/helpers/analytics.helper";
import { cn } from "@/helpers/common.helper";

type Props = {
  analytics: IAnalyticsResponse;
  barGraphData: {
    data: BarDatum[];
    xAxisKeys: string[];
  };
  params: IAnalyticsParams;
  yAxisKey: "count" | "estimate";
};

export const AnalyticsTable: React.FC<Props> = ({ analytics, barGraphData, params, yAxisKey }) => {
  // 프로젝트 추정 타입 정보 가져오기
  const { project } = params;
  const { currentActiveEstimateIdByProjectId, estimateById } = useProjectEstimates();
  const currentEstimateId = project?.[0] ? currentActiveEstimateIdByProjectId(project[0]) : undefined;
  const estimateDetails = currentEstimateId ? estimateById(currentEstimateId) : undefined;
  const estimateType = estimateDetails?.type;

  return (
    <div className="w-full overflow-hidden overflow-x-auto">
      <table className="w-full overflow-hidden divide-y divide-custom-border-200 whitespace-nowrap border-y border-custom-border-200">
        <thead className="bg-custom-background-80">
          <tr className="divide-x divide-custom-border-200 text-sm text-custom-text-100">
            <th scope="col" className="px-page-x py-3 text-left font-medium">
              {ANALYTICS_X_AXIS_VALUES.find((v) => v.value === params.x_axis)?.label}
            </th>
            {params.segment ? (
              barGraphData.xAxisKeys.map((key) => (
                <th
                  key={`segment-${key}`}
                  scope="col"
                  className={`px-page-x py-3 text-left font-medium ${
                    params.segment === "priority" || params.segment === "state__group" ? "capitalize" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {params.segment === "priority" ? (
                      <PriorityIcon priority={key as TIssuePriorities} />
                    ) : (
                      <span
                        className="h-3 w-3 flex-shrink-0 rounded"
                        style={{
                          backgroundColor: generateBarColor(key, analytics, params, "segment"),
                        }}
                      />
                    )}
                    {renderChartDynamicLabel(generateDisplayName(key, analytics, params, "segment"))?.label}
                  </div>
                </th>
              ))
            ) : (
              <th scope="col" className="px-page-x py-3 text-left font-medium sm:pr-0">
                {ANALYTICS_Y_AXIS_VALUES.find((v) => v.value === params.y_axis)?.label}
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-custom-border-200">
          {barGraphData.data.map((item, index) => (
            <tr key={`table-row-${index}`} className="divide-x divide-custom-border-200 text-xs text-custom-text-200">
              <td className="px-page-x py-2">
                <div className="relative flex items-center gap-2 w-full overflow-hidden">
                  <div className="flex-shrink-0 h-3 w-3 rounded overflow-hidden">
                    {params.x_axis === "priority" ? (
                      <PriorityIcon size={12} priority={(item.name as string).toLowerCase() as TIssuePriorities} />
                    ) : (
                      <div
                        className="w-full h-full"
                        style={{
                          backgroundColor: generateBarColor(`${item.name}`, analytics, params, "x_axis"),
                        }}
                      />
                    )}
                  </div>
                  <div
                    className={cn(
                      "font-medium",
                      ["priority", "state__group"].includes(params.x_axis) ? `capitalize` : ``
                    )}
                  >
                    <Tooltip tooltipContent={generateDisplayName(`${item.name}`, analytics, params, "x_axis")}>
                      <div className="overflow-hidden w-full whitespace-normal break-words truncate line-clamp-1">
                        {generateDisplayName(`${item.name}`, analytics, params, "x_axis")}
                      </div>
                    </Tooltip>
                  </div>
                </div>
              </td>
              {params.segment ? (
                barGraphData.xAxisKeys.map((key, index) => (
                  <td key={`segment-value-${index}`} className="whitespace-nowrap px-page-x py-2 sm:pr-0">
                    {params.y_axis === "estimate" && item[key] !== undefined
                      ? formatAnalyticsEstimateValue(item[key] as number, estimateType as EEstimateSystem)
                      : item[key] ?? 0}
                  </td>
                ))
              ) : (
                <td className="whitespace-nowrap px-page-x py-2 sm:pr-0">
                  {params.y_axis === "estimate" && item[yAxisKey] !== undefined
                    ? formatAnalyticsEstimateValue(item[yAxisKey] as number, estimateType as EEstimateSystem)
                    : item[yAxisKey]}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
