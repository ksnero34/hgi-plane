import React, { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Plus, Settings, Play, Pause, Trash2, Edit } from "lucide-react";
// ui
import { Button, Loader } from "@plane/ui";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
// types
import type { IWorkflowTemplate, IWorkflowTemplateFormData } from "@plane/types";
// hooks
import { useWorkflow } from "@/hooks/store/use-workflow";
// components
import { WorkflowTemplateModal } from "./workflow-template-modal";
import { WorkflowStatesList } from "./workflow-states-list";
import { WorkflowTransitionsList } from "./workflow-transitions-list";

export const WorkflowManagement = observer(() => {
  // router
  const { workspaceSlug, projectId } = useParams();
  // store hooks
  const { getWorkflowTemplates, fetchWorkflowTemplates, activateWorkflow, deactivateWorkflow, deleteWorkflowTemplate } =
    useWorkflow();

  // local state
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<IWorkflowTemplate | null>(null);
  const [expandedWorkflow, setExpandedWorkflow] = useState<string | null>(null);

  // derived values
  const workflows = getWorkflowTemplates(projectId as string);

  useEffect(() => {
    if (workspaceSlug && projectId) {
      fetchWorkflowTemplates(workspaceSlug as string, projectId as string).finally(() => setIsLoading(false));
    }
  }, [workspaceSlug, projectId, fetchWorkflowTemplates]);

  const handleActivateWorkflow = async (workflowId: string) => {
    if (!workspaceSlug || !projectId) return;

    try {
      await activateWorkflow(workspaceSlug as string, projectId as string, workflowId);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "워크플로우가 활성화되었습니다.",
      });
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "워크플로우 활성화에 실패했습니다.",
      });
    }
  };

  const handleDeactivateWorkflow = async (workflowId: string) => {
    if (!workspaceSlug || !projectId) return;

    try {
      await deactivateWorkflow(workspaceSlug as string, projectId as string, workflowId);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "워크플로우가 비활성화되었습니다.",
      });
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "워크플로우 비활성화에 실패했습니다.",
      });
    }
  };

  const handleDeleteWorkflow = async (workflowId: string) => {
    if (!workspaceSlug || !projectId) return;

    if (!confirm("정말로 이 워크플로우를 삭제하시겠습니까?")) return;

    try {
      await deleteWorkflowTemplate(workspaceSlug as string, projectId as string, workflowId);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "워크플로우가 삭제되었습니다.",
      });
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "워크플로우 삭제에 실패했습니다.",
      });
    }
  };

  const handleEditWorkflow = (workflow: IWorkflowTemplate) => {
    setSelectedWorkflow(workflow);
    setIsModalOpen(true);
  };

  const handleCreateWorkflow = () => {
    setSelectedWorkflow(null);
    setIsModalOpen(true);
  };

  const toggleWorkflowExpanded = (workflowId: string) => {
    setExpandedWorkflow(expandedWorkflow === workflowId ? null : workflowId);
  };

  if (isLoading) {
    return <Loader className="space-y-5">Loading...</Loader>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-custom-text-100">워크플로우 템플릿</h3>
          <p className="mt-1 text-sm text-custom-text-200">이슈의 상태 전환을 체계적으로 관리하세요.</p>
        </div>
        <Button variant="primary" onClick={handleCreateWorkflow} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />새 워크플로우
        </Button>
      </div>

      {/* Workflows List */}
      <div className="space-y-4">
        {workflows.length === 0 ? (
          <div className="text-center py-12">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-custom-background-80">
              <Settings className="h-6 w-6 text-custom-text-200" />
            </div>
            <h3 className="mt-4 text-sm font-medium text-custom-text-100">워크플로우가 없습니다</h3>
            <p className="mt-2 text-sm text-custom-text-200">첫 번째 워크플로우를 생성하여 이슈 관리를 시작하세요.</p>
            <div className="mt-6">
              <Button variant="primary" onClick={handleCreateWorkflow} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                워크플로우 생성
              </Button>
            </div>
          </div>
        ) : (
          workflows.map((workflow) => (
            <div key={workflow.id} className="rounded-lg border border-custom-border-200 bg-custom-background-100">
              {/* Workflow Header */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center space-x-3">
                  <button onClick={() => toggleWorkflowExpanded(workflow.id)} className="flex items-center space-x-3">
                    <div className={`h-3 w-3 rounded-full ${workflow.is_active ? "bg-green-500" : "bg-gray-400"}`} />
                    <div>
                      <h4 className="text-sm font-medium text-custom-text-100">{workflow.name}</h4>
                      {workflow.description && <p className="text-sm text-custom-text-200">{workflow.description}</p>}
                    </div>
                  </button>
                  {workflow.is_default && (
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                      기본값
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-sm text-custom-text-200">
                    {workflow.total_states || 0}개 상태, {workflow.total_transitions || 0}개 전환
                  </span>

                  <Button variant="neutral-primary" size="sm" onClick={() => handleEditWorkflow(workflow)}>
                    <Edit className="h-4 w-4" />
                  </Button>

                  {workflow.is_active ? (
                    <Button variant="neutral-primary" size="sm" onClick={() => handleDeactivateWorkflow(workflow.id)}>
                      <Pause className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button variant="neutral-primary" size="sm" onClick={() => handleActivateWorkflow(workflow.id)}>
                      <Play className="h-4 w-4" />
                    </Button>
                  )}

                  <Button variant="danger" size="sm" onClick={() => handleDeleteWorkflow(workflow.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Expanded Content */}
              {expandedWorkflow === workflow.id && (
                <div className="border-t border-custom-border-200 p-4 space-y-6">
                  <WorkflowStatesList workflowId={workflow.id} />
                  <WorkflowTransitionsList workflowId={workflow.id} />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      <WorkflowTemplateModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedWorkflow(null);
        }}
        workflow={selectedWorkflow}
      />
    </div>
  );
});
