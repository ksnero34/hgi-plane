"use client";

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { EIssueServiceType, TIssue } from "@plane/types";
// ui
import { setToast, TOAST_TYPE } from "@plane/ui";
// store hooks
import { useIssueDetail, useWorkflow } from "@/hooks/store";
// plane web imports
import { ChangeWorkItemStateList } from "@/plane-web/components/command-palette/actions/work-item-actions";

type Props = { closePalette: () => void; issue: TIssue };

export const ChangeIssueState: React.FC<Props> = observer((props) => {
  const { closePalette, issue } = props;
  // router params
  const { workspaceSlug } = useParams();
  // store hooks
  const { updateIssue } = useIssueDetail(issue?.is_epic ? EIssueServiceType.EPICS : EIssueServiceType.ISSUES);
  const { validateTransition } = useWorkflow();
  // derived values
  const projectId = issue?.project_id;
  const currentStateId = issue?.state_id;

  const submitChanges = async (formData: Partial<TIssue>) => {
    if (!workspaceSlug || !projectId || !issue) return;

    const payload = { ...formData };
    await updateIssue(workspaceSlug.toString(), projectId.toString(), issue.id, payload).catch((e) => {
      console.error(e);
    });
  };

  const handleIssueState = async (stateId: string) => {
    // Workflow validation before state change
    if (workspaceSlug && projectId && currentStateId !== stateId) {
      try {
        const validationResult = await validateTransition(workspaceSlug as string, projectId, {
          issue_id: issue.id,
          from_state_id: currentStateId || "",
          to_state_id: stateId,
        });
        
        if (!validationResult.allowed) {
          setToast({
            type: TOAST_TYPE.ERROR,
            title: "상태 전환 불가",
            message: validationResult.reason || "워크플로우 규칙에 의해 이 상태로의 전환이 허용되지 않습니다.",
          });
          return;
        }
      } catch (error) {
        console.warn("Workflow validation error:", error);
        // Continue with state change on validation error
      }
    }
    
    submitChanges({ state_id: stateId });
    closePalette();
  };

  return (
    <ChangeWorkItemStateList
      projectId={projectId}
      currentStateId={currentStateId}
      handleStateChange={handleIssueState}
    />
  );
});
