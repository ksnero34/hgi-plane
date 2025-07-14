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
      const requests = await getApprovalRequests(workspaceSlug as string, projectId as string);
      // Only count requests that the current user can actually approve
      const reviewableRequests = requests.filter(request => request.can_approve);
      setApprovalCount(reviewableRequests.length);
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