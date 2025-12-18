import React, { useState, useEffect } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// ui
import { Button } from "@plane/ui";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
// hooks
import { useWorkflow } from "@/hooks/store/use-workflow";

interface ApprovalRequest {
  id: string;
  issue: {
    id: string;
    name: string;
    sequence_id: number;
  };
  workflow: {
    id: string;
    name: string;
  };
  from_state: {
    id: string;
    name: string;
    color: string;
  };
  to_state: {
    id: string;
    name: string;
    color: string;
  };
  requester: {
    id: string;
    display_name: string;
    avatar: string;
  };
  comment: string;
  created_at: string;
}

export const WorkflowApprovalRequests = observer(() => {
  // router
  const { workspaceSlug, projectId } = useParams();
  // store hooks
  const { getApprovalRequests, approveTransition } = useWorkflow();
  // state
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set());

  // fetch approval requests
  const fetchApprovalRequests = async () => {
    if (!workspaceSlug || !projectId) return;

    try {
      setLoading(true);
      const response = await getApprovalRequests(
        workspaceSlug as string,
        projectId as string,
        1,
        100,
        "all",
        "",
        "newest"
      );
      setApprovalRequests(response.results || []);
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error",
        message: "Failed to fetch approval requests",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovalRequests();
  }, [workspaceSlug, projectId]);

  const handleApprove = async (approvalRequestId: string, comment: string = "") => {
    if (!workspaceSlug || !projectId) return;

    try {
      setApprovingIds((prev) => new Set(prev).add(approvalRequestId));

      await approveTransition(workspaceSlug as string, projectId as string, approvalRequestId, { comment });

      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "승인 완료",
        message: "상태 전환이 승인되어 실행되었습니다.",
      });

      // Refresh the list
      await fetchApprovalRequests();
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "승인 실패",
        message: "상태 전환 승인 중 오류가 발생했습니다.",
      });
    } finally {
      setApprovingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(approvalRequestId);
        return newSet;
      });
    }
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-custom-background-80 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-custom-text-100">워크플로우 승인 요청 ({approvalRequests.length})</h3>
        <Button variant="neutral-primary" size="sm" onClick={fetchApprovalRequests}>
          새로고침
        </Button>
      </div>

      {approvalRequests.length === 0 ? (
        <div className="text-center py-8 text-custom-text-400">승인 대기 중인 요청이 없습니다.</div>
      ) : (
        <div className="space-y-3">
          {approvalRequests.map((request) => (
            <div key={request.id} className="border border-custom-border-200 rounded-lg p-4 bg-custom-background-100">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-custom-text-100">#{request.issue.sequence_id}</span>
                    <span className="text-sm text-custom-text-200">{request.issue.name}</span>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="inline-block w-3 h-3 rounded-full"
                      style={{ backgroundColor: request.from_state.color }}
                    />
                    <span className="text-sm text-custom-text-200">{request.from_state.name}</span>
                    <span className="text-custom-text-400">→</span>
                    <span
                      className="inline-block w-3 h-3 rounded-full"
                      style={{ backgroundColor: request.to_state.color }}
                    />
                    <span className="text-sm text-custom-text-200">{request.to_state.name}</span>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-custom-text-400">요청자:</span>
                    <div className="flex items-center gap-1">
                      {request.requester.avatar && (
                        <img
                          src={request.requester.avatar}
                          alt={request.requester.display_name}
                          className="w-5 h-5 rounded-full"
                        />
                      )}
                      <span className="text-sm text-custom-text-200">{request.requester.display_name}</span>
                    </div>
                  </div>

                  {request.comment && (
                    <div className="mt-2 p-2 bg-custom-background-80 rounded text-sm text-custom-text-200">
                      {request.comment}
                    </div>
                  )}

                  <div className="text-xs text-custom-text-400 mt-2">
                    {new Date(request.created_at).toLocaleString()}
                  </div>
                </div>

                <div className="ml-4">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleApprove(request.id)}
                    loading={approvingIds.has(request.id)}
                  >
                    승인
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
