import React, { useEffect, useRef, useState } from "react";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { draggable } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { observer } from "mobx-react";
// plane helpers
import { useOutsideClickDetector } from "@plane/hooks";
// components
import { CalendarIssueBlock } from "@/components/issues";
import { useIssueDetail } from "@/hooks/store";
import { TRenderQuickActions } from "../list/list-view-types";
import { HIGHLIGHT_CLASS } from "../utils";

type Props = {
  issueId: string;
  quickActions: TRenderQuickActions;
  isDragDisabled: boolean;
  date: Date;
  isEpic?: boolean;
  canEditProperties: (projectId: string | undefined) => boolean;
  issueInfo?: {
    isStartDate: boolean;
    isEndDate: boolean;
    isContinuous: boolean;
  };
};

export const CalendarIssueBlockRoot: React.FC<Props> = observer((props) => {
  const { issueId, quickActions, isDragDisabled, date, isEpic = false, canEditProperties, issueInfo } = props;

  const issueRef = useRef<HTMLAnchorElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const {
    issue: { getIssueById },
  } = useIssueDetail();

  const issue = getIssueById(issueId);

  // console.log("Calendar Block Root - Issue Details:", {
  //   date: date.toLocaleString(),
  //   issueId,
  //   issue: issue ? {
  //     id: issue.id,
  //     name: issue.name,
  //     start_date: issue.start_date,
  //     target_date: issue.target_date,
  //     state: issue.state_id
  //   } : null
  // });
  const canDrag = !isDragDisabled && canEditProperties(issue?.project_id ?? undefined);

  useEffect(() => {
    const element = issueRef.current;

    if (!element || !issue) return;

    return combine(
      draggable({
        element,
        canDrag: () => !isDragDisabled,
        getInitialData: () => {
          // 날짜를 YYYY-MM-DD 형식으로 변환하는 헬퍼 함수
          const formatToLocalDate = (date: Date | string) => {
            const d = new Date(date);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          };

          // 날짜 비교를 위해 로컬 시간 기준으로 문자열 변환
          const currentDateStr = formatToLocalDate(date);
          const startDateStr = issue.start_date ? formatToLocalDate(issue.start_date) : null;
          const targetDateStr = issue.target_date ? formatToLocalDate(issue.target_date) : null;

          // 시작일과 종료일이 같은지 확인
          const datesAreEqual = startDateStr && targetDateStr && startDateStr === targetDateStr;

          // 현재 날짜가 start_date와 일치하는지 확인
          const isStartDate = startDateStr === currentDateStr;
          const isTargetDate = targetDateStr === currentDateStr;

          // 최종 isStartDate 결정 로직
          let finalIsStartDate = false;
          
          // 1. issueInfo에 명시적으로 isStartDate가 true로 설정된 경우
          if (issueInfo?.isStartDate === true) {
            finalIsStartDate = true;
          } 
          // 2. 시작일과 종료일이 같고 현재 날짜가 그 날짜인 경우 (시작일로 취급)
          else if (datesAreEqual && isStartDate) {
            finalIsStartDate = true;
          }
          // 3. 시작일과 종료일이 다르고, 현재 날짜가 시작일인 경우
          else if (!datesAreEqual && isStartDate) {
            finalIsStartDate = true;
          }

          // 시작일과 종료일이 같은 경우 특별 처리를 위한 플래그
          const isEqualDatesCase = datesAreEqual && isStartDate;

          // console.log("Issue Block Root - Drag Initial Data:", {
          //   issue: {
          //     id: issue.id,
          //     name: issue.name,
          //     startDate: issue.start_date,
          //     targetDate: issue.target_date
          //   },
          //   dates: {
          //     currentDate: currentDateStr,
          //     startDate: startDateStr,
          //     targetDate: targetDateStr,
          //     datesAreEqual
          //   },
          //   checks: {
          //     isStartDate,
          //     isTargetDate,
          //     issueInfoStartDate: issueInfo?.isStartDate,
          //     isEqualDatesCase,
          //     finalIsStartDate
          //   },
          //   issueInfo
          // });

          // 시작일과 종료일이 같은 경우에는 isStartDate 플래그를 전달하지 않음
          // 이렇게 하면 base-calendar-root.tsx에서 드롭 위치에 따라 처리할 수 있음
          if (isEqualDatesCase) {
            return { 
              id: issue.id, 
              projectId: issue.project_id,
              date: currentDateStr,
              isEqualDatesCase: true,
              element,
              issue
            };
          } else {
            return { 
              id: issue.id, 
              projectId: issue.project_id,
              date: currentDateStr,
              isStartDate: finalIsStartDate,
              isEqualDatesCase: false,
              element,
              issue
            };
          }
        },
        onDragStart: () => {
          setIsDragging(true);
          element.classList.add(HIGHLIGHT_CLASS);
        },
        onDrop: () => {
          setIsDragging(false);
          element.classList.remove(HIGHLIGHT_CLASS);
        },
      })
    );
  }, [issueRef?.current, issue, isDragDisabled, date, issueInfo]);

  useOutsideClickDetector(issueRef, () => {
    issueRef?.current?.classList?.remove(HIGHLIGHT_CLASS);
  });

  if (!issue) {
    console.warn(`Issue not found for ID: ${issueId}`);
    return null;
  }

  return (
    <CalendarIssueBlock 
      isDragging={isDragging} 
      issue={issue} 
      quickActions={quickActions} 
      ref={issueRef} 
      date={date}
      isEpic={isEpic}
      issueInfo={issueInfo}
    />
  );
});
