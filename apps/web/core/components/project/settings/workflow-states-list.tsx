import React, { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Plus, Settings } from "lucide-react";
// ui
import { Button, Loader } from "@plane/ui";
// types
import type { IWorkflowState } from "@plane/types";
// hooks
import { useWorkflow } from "@/hooks/store/use-workflow";
import { useProjectState } from "@/hooks/store/use-project-state";
// components
import { WorkflowStateModal } from "./workflow-state-modal";

interface Props {
  workflowId: string;
}

export const WorkflowStatesList = observer(({ workflowId }: Props) => {
  // router
  const { workspaceSlug, projectId } = useParams();
  // store hooks
  const { getWorkflowStates, fetchWorkflowStates } = useWorkflow();
  const { projectStates } = useProjectState();

  // local state
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedState, setSelectedState] = useState<IWorkflowState | null>(null);

  // derived values
  const workflowStates = getWorkflowStates(workflowId);

  useEffect(() => {
    if (workspaceSlug && projectId && workflowId) {
      fetchWorkflowStates(workspaceSlug as string, projectId as string, workflowId).finally(() => setIsLoading(false));
    }
  }, [workspaceSlug, projectId, workflowId, fetchWorkflowStates]);

  const handleAddState = () => {
    setSelectedState(null);
    setIsModalOpen(true);
  };

  const handleEditState = (state: IWorkflowState) => {
    setSelectedState(state);
    setIsModalOpen(true);
  };

  if (isLoading) {
    return <Loader className="space-y-2">Loading...</Loader>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h5 className="text-sm font-medium text-custom-text-100">워크플로우 상태</h5>
        <Button variant="neutral-primary" size="sm" onClick={handleAddState} className="flex items-center gap-2">
          <Plus className="h-3 w-3" />
          상태 추가
        </Button>
      </div>

      {workflowStates.length === 0 ? (
        <div className="text-center py-6">
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-custom-background-80">
            <Settings className="h-4 w-4 text-custom-text-200" />
          </div>
          <h4 className="mt-2 text-sm font-medium text-custom-text-100">상태가 없습니다</h4>
          <p className="mt-1 text-sm text-custom-text-200">워크플로우에 포함할 상태를 추가하세요.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {workflowStates
            .slice()
            .sort((a, b) => a.sequence - b.sequence)
            .map((workflowState) => (
              <div
                key={workflowState.id}
                className="flex items-center justify-between p-3 rounded-md border border-custom-border-200 bg-custom-background-100 cursor-pointer hover:bg-custom-background-80"
                onClick={() => handleEditState(workflowState)}
              >
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-custom-text-200">#{workflowState.sequence}</span>
                    {workflowState.state_detail && (
                      <>
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: workflowState.state_detail.color }}
                        />
                        <span className="text-sm text-custom-text-100">{workflowState.state_detail.name}</span>
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 capitalize">
                          {workflowState.state_detail.group}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {workflowState.allow_new_issues && (
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                      새 이슈 허용
                    </span>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Modal */}
      <WorkflowStateModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedState(null);
        }}
        workflowId={workflowId}
        workflowState={selectedState}
      />
    </div>
  );
});
