"use client";

import { useParams } from "next/navigation";
import { mutate } from "swr";
// types
import { IAnalyticsParams, IAnalyticsResponse } from "@plane/types";
// ui
import { Button, Loader } from "@plane/ui";
// components
import { AnalyticsGraph, AnalyticsTable } from "@/components/analytics";
// hooks
import { useProjectEstimates } from "@/hooks/store";
import { EEstimateSystem } from "@plane/types/src/enums";
// fetch-keys
import { ANALYTICS } from "@/constants/fetch-keys";
// helpers
import { convertResponseToBarGraphData } from "@/helpers/analytics.helper";

type Props = {
  analytics: IAnalyticsResponse | undefined;
  error: any;
  fullScreen: boolean;
  params: IAnalyticsParams;
};

export const CustomAnalyticsMainContent: React.FC<Props> = (props) => {
  const { analytics, error, fullScreen, params } = props;

  const { workspaceSlug } = useParams();
  
  // 프로젝트 추정 타입 정보 가져오기
  const { projectId } = params;
  const { currentActiveEstimateIdByProjectId, estimateById } = useProjectEstimates();
  const currentEstimateId = projectId?.[0] ? currentActiveEstimateIdByProjectId(projectId[0]) : undefined;
  const estimateDetails = currentEstimateId ? estimateById(currentEstimateId) : undefined;
  const estimateType = estimateDetails?.type;

  const yAxisKey = params.y_axis === "issue_count" ? "count" : "estimate";
  const barGraphData = convertResponseToBarGraphData(analytics?.distribution, params, estimateType);

  // 차트 데이터 가공 시 정렬 유지
  const sortTimeEstimateData = (data: BarDatum[], yAxisKey: string): BarDatum[] => {
    if (!data || data.length === 0) return data;
    
    // X축이 추정값이고 숫자로 변환 가능한 경우 숫자 기준 정렬
    const isNumericName = data.every(item => !isNaN(parseInt(`${item.name}`.replace(/[^0-9]/g, ''), 10)));
    
    if (isNumericName) {
      return [...data].sort((a, b) => {
        const aValue = parseInt(`${a.name}`.replace(/[^0-9]/g, ''), 10);
        const bValue = parseInt(`${b.name}`.replace(/[^0-9]/g, ''), 10);
        return aValue - bValue;
      });
    }
    
    return data;
  };

  // 시간 타입이면 추가 정렬 적용
  if (estimateType === EEstimateSystem.TIME && params.x_axis === "estimate_point__value") {
    barGraphData.data = sortTimeEstimateData(barGraphData.data, yAxisKey);
  }

  return (
    <>
      {!error ? (
        analytics ? (
          analytics.total > 0 ? (
            <div className="h-full overflow-y-auto vertical-scrollbar scrollbar-md">
              <AnalyticsGraph
                analytics={analytics}
                barGraphData={barGraphData}
                params={params}
                yAxisKey={yAxisKey}
                fullScreen={fullScreen}
              />
              <AnalyticsTable analytics={analytics} barGraphData={barGraphData} params={params} yAxisKey={yAxisKey} />
            </div>
          ) : (
            <div className="grid h-full place-items-center p-5">
              <div className="space-y-4 text-custom-text-200">
                <p className="text-sm">No matching work items found. Try changing the parameters.</p>
              </div>
            </div>
          )
        ) : (
          <Loader className="space-y-6">
            <Loader.Item height="300px" />
            <Loader className="space-y-4">
              <Loader.Item height="30px" />
              <Loader.Item height="30px" />
              <Loader.Item height="30px" />
              <Loader.Item height="30px" />
            </Loader>
          </Loader>
        )
      ) : (
        <div className="grid h-full place-items-center p-5">
          <div className="space-y-4 text-custom-text-200">
            <p className="text-sm">There was some error in fetching the data.</p>
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="primary"
                onClick={() => {
                  if (!workspaceSlug) return;

                  mutate(ANALYTICS(workspaceSlug.toString(), params));
                }}
              >
                Refresh
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
