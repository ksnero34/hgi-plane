import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useWorkflow } from "./use-workflow";

export const useWorkflowApproval = () => {
  const { workspaceSlug, projectId } = useParams();
  const { getApprovalRequests } = useWorkflow();
  
  const [approvalCount, setApprovalCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchApprovalCount = async () => {
    if (!workspaceSlug || !projectId) return;

    try {
      setLoading(true);
      // Fetch only the first page to get the can_approve_count
      const response = await getApprovalRequests(workspaceSlug as string, projectId as string, 1, 1);
      // Use the can_approve_count from the server response
      setApprovalCount(response.can_approve_count || 0);
    } catch (error) {
      console.error("Error fetching approval count:", error);
      setApprovalCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovalCount();
  }, [workspaceSlug, projectId]);

  return {
    approvalCount,
    loading,
    refreshApprovalCount: fetchApprovalCount,
  };
};