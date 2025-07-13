"use client";

import React, { useState, useEffect } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// icons
import { CheckCircle, XCircle, User, Clock, MessageSquare } from "lucide-react";
// ui
import { Button, ModalCore, EModalPosition, EModalWidth, setToast, TOAST_TYPE, TextArea } from "@plane/ui";
// hooks
import { useWorkflow } from "@/hooks/store";

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

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onApprovalProcessed?: () => void;
}

export const WorkflowApprovalModal = observer(({ isOpen, onClose, onApprovalProcessed }: Props) => {
  // router
  const { workspaceSlug, projectId } = useParams();
  // store hooks
  const { getApprovalRequests, approveTransition } = useWorkflow();
  // state
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [comment, setComment] = useState("");

  // fetch approval requests
  const fetchApprovalRequests = async () => {
    if (!workspaceSlug || !projectId) return;

    try {
      setLoading(true);
      const requests = await getApprovalRequests(workspaceSlug as string, projectId as string);
      setApprovalRequests(requests);
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
    if (isOpen) {
      fetchApprovalRequests();
    }
  }, [isOpen, workspaceSlug, projectId]);

  const handleApprove = async (approvalRequestId: string, approvalComment: string = "") => {
    if (!workspaceSlug || !projectId) return;

    try {
      setProcessingIds(prev => new Set(prev).add(approvalRequestId));
      
      await approveTransition(
        workspaceSlug as string,
        projectId as string,
        approvalRequestId,
        { comment: approvalComment }
      );

      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "승인 완료",
        message: "상태 전환이 승인되어 실행되었습니다.",
      });

      // Refresh the list
      await fetchApprovalRequests();
      
      // Reset comment
      setComment("");
      setSelectedRequest(null);
      
      // Notify parent component
      onApprovalProcessed?.();
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "승인 실패",
        message: "상태 전환 승인 중 오류가 발생했습니다.",
      });
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(approvalRequestId);
        return newSet;
      });
    }
  };

  const handleReject = async (approvalRequestId: string, rejectionComment: string = "") => {
    // TODO: Implement rejection API if needed
    setToast({
      type: TOAST_TYPE.INFO,
      title: "거부 기능",
      message: "거부 기능은 아직 구현되지 않았습니다.",
    });
  };

  return (
    <ModalCore
      isOpen={isOpen}
      handleClose={onClose}
      position={EModalPosition.CENTER}
      width={EModalWidth.XXL}
    >
      <div className="p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-custom-text-100">
            워크플로우 승인 요청 ({approvalRequests.length})
          </h3>
          <p className="text-sm text-custom-text-200 mt-1">
            승인 대기 중인 상태 전환 요청을 검토하고 처리하세요.
          </p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-24 bg-custom-background-80 rounded-lg" />
              </div>
            ))}
          </div>
        ) : approvalRequests.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="h-12 w-12 text-custom-text-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-custom-text-100 mb-2">
              승인 대기 중인 요청이 없습니다
            </h4>
            <p className="text-custom-text-200">
              현재 승인이 필요한 워크플로우 전환 요청이 없습니다.
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {approvalRequests.map((request) => (
              <div
                key={request.id}
                className="border border-custom-border-200 rounded-lg p-4 bg-custom-background-100"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-custom-text-100">
                        #{request.issue.sequence_id}
                      </span>
                      <span className="text-sm text-custom-text-200">
                        {request.issue.name}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="inline-block w-3 h-3 rounded-full"
                        style={{ backgroundColor: request.from_state.color }}
                      />
                      <span className="text-sm text-custom-text-200">
                        {request.from_state.name}
                      </span>
                      <span className="text-custom-text-400">→</span>
                      <span
                        className="inline-block w-3 h-3 rounded-full"
                        style={{ backgroundColor: request.to_state.color }}
                      />
                      <span className="text-sm text-custom-text-200">
                        {request.to_state.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      <User className="h-4 w-4 text-custom-text-400" />
                      <span className="text-xs text-custom-text-400">요청자:</span>
                      <div className="flex items-center gap-1">
                        {request.requester.avatar && (
                          <img
                            src={request.requester.avatar}
                            alt={request.requester.display_name}
                            className="w-5 h-5 rounded-full"
                          />
                        )}
                        <span className="text-sm text-custom-text-200">
                          {request.requester.display_name}
                        </span>
                      </div>
                    </div>

                    {request.comment && (
                      <div className="mt-2 p-2 bg-custom-background-80 rounded text-sm text-custom-text-200">
                        <MessageSquare className="h-4 w-4 inline mr-1" />
                        {request.comment}
                      </div>
                    )}

                    <div className="text-xs text-custom-text-400 mt-2">
                      {new Date(request.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Approval Actions */}
                <div className="border-t border-custom-border-200 pt-3">
                  {selectedRequest === request.id ? (
                    <div className="space-y-3">
                      <TextArea
                        placeholder="승인 사유를 입력하세요 (선택사항)"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        rows={2}
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleApprove(request.id, comment)}
                          loading={processingIds.has(request.id)}
                          className="flex items-center gap-1"
                        >
                          <CheckCircle className="h-4 w-4" />
                          승인
                        </Button>
                        <Button
                          variant="neutral-primary"
                          size="sm"
                          onClick={() => handleReject(request.id, comment)}
                          loading={processingIds.has(request.id)}
                          className="flex items-center gap-1"
                        >
                          <XCircle className="h-4 w-4" />
                          거부
                        </Button>
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => {
                            setSelectedRequest(null);
                            setComment("");
                          }}
                        >
                          취소
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setSelectedRequest(request.id)}
                        disabled={processingIds.has(request.id)}
                      >
                        검토
                      </Button>
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => handleApprove(request.id)}
                        loading={processingIds.has(request.id)}
                        className="flex items-center gap-1"
                      >
                        <CheckCircle className="h-4 w-4" />
                        즉시 승인
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-custom-border-200">
          <Button variant="neutral-primary" onClick={onClose}>
            닫기
          </Button>
          <Button 
            variant="outline-primary" 
            size="sm" 
            onClick={fetchApprovalRequests}
            disabled={loading}
          >
            새로고침
          </Button>
        </div>
      </div>
    </ModalCore>
  );
});