"use client";

import { FC } from "react";
import { observer } from "mobx-react";
// plane imports
import { LayersIcon } from "@plane/propel/icons";
import { EInboxIssueSource } from "@plane/types";
// hooks
import { capitalizeFirstLetter } from "@plane/utils";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
// local imports
import { IssueActivityBlockComponent } from "./";

type TIssueDefaultActivity = { activityId: string; ends: "top" | "bottom" | undefined };

export const IssueDefaultActivity: FC<TIssueDefaultActivity> = observer((props) => {
  const { activityId, ends } = props;
  // hooks
  const {
    activity: { getActivityById },
  } = useIssueDetail();

  const activity = getActivityById(activityId);

  if (!activity) return <></>;
  const source = activity.source_data?.source;

  return (
    <IssueActivityBlockComponent
      activityId={activityId}
      icon={<LayersIcon width={14} height={14} className="text-custom-text-200" aria-hidden="true" />}
      ends={ends}
    >
      <>
        {activity.verb === "created" ? (
          source && source !== EInboxIssueSource.IN_APP ? (
            <span>
              {" "}
              <span className="font-medium">{capitalizeFirstLetter(source.toLowerCase() || "")}</span> 을 통해 작업항목을 생성했습니다.
            </span>
          ) : (
            <span> 님이 작업항목을 생성했습니다.</span>
          )
        ) : (
          <span> 님이 작업항목을 삭제했습니다.</span>
        )}
      </>
    </IssueActivityBlockComponent>
  );
});
