"use client";

import { useParams } from "next/navigation";
import { mutate } from "swr";
// nivo
import { BarDatum } from "@nivo/bar";
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
  const { project } = params;
  const { currentActiveEstimateIdByProjectId, estimateById } = useProjectEstimates();
  const currentEstimateId = project?.[0] ? currentActiveEstimateIdByProjectId(project[0]) : undefined;
  const estimateDetails = currentEstimateId ? estimateById(currentEstimateId) : undefined;
  const estimateType = estimateDetails?.type;

  const yAxisKey = params.y_axis === "issue_count" ? "count" : "estimate";
  let barGraphData = convertResponseToBarGraphData(analytics?.distribution, params, estimateType);

  // 시간 타입이면 추가 정렬 적용
  if (estimateType === EEstimateSystem.TIME && params.x_axis === "estimate_point__value" && barGraphData.data.length > 0) {
    // 숫자만 추출하는 함수
    const extractNumber = (str: string): number => {
      const match = str.toString().match(/(\d+)/g);
      return match ? parseInt(match.join(''), 10) : 0;
    };

    // 데이터 정렬
    barGraphData.data.sort((a, b) => {
      return extractNumber(a.name.toString()) - extractNumber(b.name.toString());
    });
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
