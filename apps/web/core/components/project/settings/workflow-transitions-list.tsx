import React, { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Plus, ArrowRight, Settings, Shield } from "lucide-react";
// ui
import { Button, Loader } from "@plane/ui";
// types
import { IWorkflowTransition } from "@plane/types";
// hooks
import { useWorkflow } from "@/hooks/store/use-workflow";
// components
import { WorkflowTransitionModal } from "./workflow-transition-modal";

interface Props {
  workflowId: string;
}

export const WorkflowTransitionsList = observer(({ workflowId }: Props) => {
  // router
  const { workspaceSlug, projectId } = useParams();
  // store hooks
  const { getWorkflowTransitions, fetchWorkflowTransitions } = useWorkflow();

  // local state
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTransition, setSelectedTransition] = useState<IWorkflowTransition | null>(null);

  // derived values
  const workflowTransitions = getWorkflowTransitions(workflowId);

  useEffect(() => {
    if (workspaceSlug && projectId && workflowId) {
      fetchWorkflowTransitions(workspaceSlug as string, projectId as string, workflowId).finally(() =>
        setIsLoading(false)
      );
    }
  }, [workspaceSlug, projectId, workflowId, fetchWorkflowTransitions]);

  const handleAddTransition = () => {
    setSelectedTransition(null);
    setIsModalOpen(true);
  };

  const handleEditTransition = (transition: IWorkflowTransition) => {
    setSelectedTransition(transition);
    setIsModalOpen(true);
  };

  if (isLoading) {
    return <Loader className="space-y-2">Loading...</Loader>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h5 className="text-sm font-medium text-custom-text-100">상태 전환 규칙</h5>
        <Button variant="neutral-primary" size="sm" onClick={handleAddTransition} className="flex items-center gap-2">
          <Plus className="h-3 w-3" />
          전환 규칙 추가
        </Button>
      </div>

      {workflowTransitions.length === 0 ? (
        <div className="text-center py-6">
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-custom-background-80">
            <Settings className="h-4 w-4 text-custom-text-200" />
          </div>
          <h4 className="mt-2 text-sm font-medium text-custom-text-100">전환 규칙이 없습니다</h4>
          <p className="mt-1 text-sm text-custom-text-200">상태 간 전환을 제어할 규칙을 추가하세요.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {workflowTransitions.map((transition) => (
            <div
              key={transition.id}
              className="flex items-center justify-between p-3 rounded-md border border-custom-border-200 bg-custom-background-100 cursor-pointer hover:bg-custom-background-80"
              onClick={() => handleEditTransition(transition)}
            >
              <div className="flex items-center space-x-3">
                {/* From State */}
                {transition.from_state_detail && (
                  <div className="flex items-center space-x-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: transition.from_state_detail.color }}
                    />
                    <span className="text-sm text-custom-text-100">{transition.from_state_detail.name}</span>
                  </div>
                )}

                <ArrowRight className="h-4 w-4 text-custom-text-300" />

                {/* To State */}
                {transition.to_state_detail && (
                  <div className="flex items-center space-x-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: transition.to_state_detail.color }}
                    />
                    <span className="text-sm text-custom-text-100">{transition.to_state_detail.name}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2">
                {transition.require_reviewer && (
                  <div className="flex items-center space-x-1">
                    <Shield className="h-3 w-3 text-orange-500" />
                    <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800">
                      승인 필요
                    </span>
                  </div>
                )}

                {transition.reviewers && transition.reviewers.length > 0 && (
                  <span className="text-xs text-custom-text-200">{transition.reviewers.length}명의 승인자</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <WorkflowTransitionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedTransition(null);
        }}
        workflowId={workflowId}
        workflowTransition={selectedTransition}
      />
    </div>
  );
});
