import type { TIssueServiceType } from "@plane/types";

import { useEffect } from "react";
// stores
import { useProjectState } from "@/hooks/store/use-project-state";
import { useWorkflow } from "@/hooks/store/use-workflow";

export const useWorkItemProperties = (
  projectId: string | null | undefined,
  workspaceSlug: string | null | undefined,
  _workItemId: string | null | undefined,
  _issueServiceType: TIssueServiceType
) => {
  const { getProjectStates, fetchProjectStates } = useProjectState();
  const {
    fetchWorkflowTemplates,
    getDefaultWorkflow,
    getWorkflowStates,
    getWorkflowTransitions,
    fetchWorkflowStates,
    fetchWorkflowTransitions,
  } = useWorkflow();

  // Ensure project states are available for dropdowns and peek views
  useEffect(() => {
    if (!workspaceSlug || !projectId) return;
    const existingStates = getProjectStates(projectId);
    if (existingStates && existingStates.length > 0) return;

    fetchProjectStates(workspaceSlug, projectId).catch((error) => {
      console.error("useWorkItemProperties: failed to fetch project states", error);
    });
  }, [workspaceSlug, projectId, getProjectStates, fetchProjectStates]);

  // Preload workflow templates, states, and transitions so dropdowns have data
  useEffect(() => {
    if (!workspaceSlug || !projectId) return;

    const ensureWorkflowData = async () => {
      try {
        let defaultWorkflow = getDefaultWorkflow(projectId);
        if (!defaultWorkflow) {
          await fetchWorkflowTemplates(workspaceSlug, projectId);
          defaultWorkflow = getDefaultWorkflow(projectId);
        }
        if (!defaultWorkflow) return;

        const workflowId = defaultWorkflow.id;

        const existingStates = getWorkflowStates(workflowId);
        if (!existingStates || existingStates.length === 0) {
          await fetchWorkflowStates(workspaceSlug, projectId, workflowId);
        }

        const existingTransitions = getWorkflowTransitions(workflowId);
        if (!existingTransitions || existingTransitions.length === 0) {
          await fetchWorkflowTransitions(workspaceSlug, projectId, workflowId);
        }
      } catch (error) {
        console.error("useWorkItemProperties: failed to preload workflow data", error);
      }
    };

    ensureWorkflowData();
  }, [
    workspaceSlug,
    projectId,
    fetchWorkflowTemplates,
    getDefaultWorkflow,
    getWorkflowStates,
    fetchWorkflowStates,
    getWorkflowTransitions,
    fetchWorkflowTransitions,
  ]);
};
