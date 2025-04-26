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
  const { issueId, quickActions, isDragDisabled, date, canEditProperties, isEpic = false, issueInfo } = props;

  // states
  const [isDragging, setIsDragging] = useState(false);

  // refs
  const issueRef = useRef<HTMLDivElement>(null);

  // store hooks
  const { issue: issueDetails } = useIssueDetail();
  const { getIssueById } = issueDetails;

  // issue from the store
  const issue = getIssueById(issueId);
  if (!issue) return null;

  useEffect(() => {
    const element = issueRef.current;
    if (!element || isDragDisabled) return;

    // 날짜를 YYYY-MM-DD 형식으로 변환하는 헬퍼 함수
    const formatToLocalDate = (date: Date | string) => {
      const d = new Date(date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    // 날짜 비교를 위해 로컬 시간 기준으로 문자열 변환
    const dateString = formatToLocalDate(date);
    const startDateString = issue.start_date ? formatToLocalDate(issue.start_date) : null;
    const targetDateString = issue.target_date ? formatToLocalDate(issue.target_date) : null;

    // 시작일과 종료일이 같은지 확인
    const hasSameDates = startDateString && targetDateString && startDateString === targetDateString;

    // issue.start_date와 issue.target_date가 설정되었는지 확인
    const hasStartDate = !!startDateString;
    const hasTargetDate = !!targetDateString;

    // 현재 표시되는 날짜가 시작일인지 종료일인지 결정
    // 1. 날짜가 시작일과 종료일이 같고, 현재 날짜가 그 날짜인 경우 (특별한 경우로 표시)
    const isEqualDatesCase = hasSameDates && dateString === startDateString;
    
    // 2. 날짜가 시작일인지 확인 (시작일과 종료일이 다른 경우)
    const isStart = !hasSameDates && hasStartDate && dateString === startDateString;
    
    // 3. 날짜가 종료일인지 확인 (시작일과 종료일이 다른 경우)
    const isEnd = !hasSameDates && hasTargetDate && dateString === targetDateString;

    // 드래그 가능한 플래그 설정
    const isDragEnabled = !isDragDisabled && (isStart || isEnd || isEqualDatesCase);

    if (!isDragEnabled) return;

    // 드래그 설정
    return combine(
      draggable({
        element,
        getInitialData: () => {
          setIsDragging(true);
          // 디버깅을 위한 로그
          // console.log("[중요] 드래그 시작 데이터:", {
          //   id: issue?.id,
          //   date: dateString,
          //   isStartDate: isStart || (isEqualDatesCase ? null : false),
          //   isEqualDatesCase: isEqualDatesCase
          // });
          return {
            id: issue?.id,
            date: dateString,
            isStartDate: isStart || (isEqualDatesCase ? null : false),
            isEqualDatesCase: isEqualDatesCase
          };
        },
        onDragStart: ({ source }) => {
          source.element.classList.add(HIGHLIGHT_CLASS);
        },
        onDrop: () => {
          setIsDragging(false);
        },
      })
    );
  }, [issueId, date, isDragDisabled]);

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
      className="h-full overflow-hidden w-full"
    />
  );
});
