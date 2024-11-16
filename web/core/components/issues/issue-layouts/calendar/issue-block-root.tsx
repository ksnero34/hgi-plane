import React, { useEffect, useRef, useState } from "react";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { draggable } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { observer } from "mobx-react";
// plane helpers
import { useOutsideClickDetector } from "@plane/helpers";
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
};

export const CalendarIssueBlockRoot: React.FC<Props> = observer((props) => {
  const { issueId, quickActions, isDragDisabled, date } = props;

  const issueRef = useRef<HTMLAnchorElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const {
    issue: { getIssueById },
  } = useIssueDetail();

  const issue = getIssueById(issueId);

  console.log("Calendar Block Root - Issue Details:", {
    date: date.toLocaleString(),
    issueId,
    issue: issue ? {
      id: issue.id,
      name: issue.name,
      start_date: issue.start_date,
      target_date: issue.target_date,
      state: issue.state_id
    } : null
  });

  useEffect(() => {
    const element = issueRef.current;

    if (!element || !issue) return;

    return combine(
      draggable({
        element,
        canDrag: () => !isDragDisabled,
        getInitialData: () => ({ 
          id: issue.id, 
          date: issue.target_date || issue.start_date 
        }),
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
  }, [issueRef?.current, issue, isDragDisabled]);

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
    />
  );
});
