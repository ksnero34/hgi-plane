import React, { useEffect, useMemo, useRef, useState } from "react";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { draggable } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { observer } from "mobx-react";
// plane helpers
import { useOutsideClickDetector } from "@plane/hooks";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
// local components
import { TRenderQuickActions } from "../list/list-view-types";
import { HIGHLIGHT_CLASS } from "./utils";
import { CalendarIssueBlock } from "./issue-block";

const formatToLocalDate = (value: Date | string | null | undefined): string | null => {
  if (!value) return null;
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

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

  const issueRef = useRef<HTMLAnchorElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const {
    issue: { getIssueById },
  } = useIssueDetail();

  const issue = useMemo(() => getIssueById(issueId), [getIssueById, issueId]);

  const canDrag = useMemo(() => !isDragDisabled && canEditProperties(issue?.project_id ?? undefined), [
    canEditProperties,
    isDragDisabled,
    issue?.project_id,
  ]);

  useEffect(() => {
    const element = issueRef.current;
    if (!element || !issue || !canDrag) return;

    const dateString = formatToLocalDate(date);
    const startDateString = formatToLocalDate(issue.start_date);
    const targetDateString = formatToLocalDate(issue.target_date);

    const hasSameDates = Boolean(startDateString && targetDateString && startDateString === targetDateString);
    const isStart = !hasSameDates && startDateString === dateString;
    const isEnd = !hasSameDates && targetDateString === dateString;
    const isEqualDatesCase = hasSameDates && startDateString === dateString;

    const isDraggableForDate = canDrag && (isStart || isEnd || isEqualDatesCase);

    if (!isDraggableForDate) return;

    return combine(
      draggable({
        element,
        getInitialData: () => {
          setIsDragging(true);
          return {
            id: issue.id,
            date: dateString,
            isStartDate: isEqualDatesCase ? null : isStart,
            isEqualDatesCase,
          };
        },
        onDragStart: ({ source }) => {
          source.element.classList.add(HIGHLIGHT_CLASS);
        },
        onDrop: ({ source }) => {
          setIsDragging(false);
          source.element.classList.remove(HIGHLIGHT_CLASS);
        },
      })
    );
  }, [canDrag, date, issue]);

  useOutsideClickDetector(issueRef, () => {
    issueRef.current?.classList?.remove(HIGHLIGHT_CLASS);
  });

  if (!issue) return null;

  return (
    <CalendarIssueBlock
      isDragging={isDragging}
      issue={issue}
      quickActions={quickActions}
      date={date}
      isEpic={isEpic}
      issueInfo={issueInfo}
      ref={issueRef}
    />
  );
});
