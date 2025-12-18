import React, { useState, useEffect } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// icons
import {
  CheckCircle,
  XCircle,
  User,
  Clock,
  MessageSquare,
  Search,
  Filter,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Settings,
} from "lucide-react";
// ui
import { Button, ModalCore, EModalPosition, EModalWidth, TextArea } from "@plane/ui";
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
  transition: {
    id: string;
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
  };
  requester: {
    id: string;
    display_name: string;
    email: string;
  };
  reviewers: Array<{
    id: string;
    display_name: string;
    email: string;
  }>;
  status: string;
  comment: string;
  approved_by?: {
    id: string;
    display_name: string;
    email: string;
  };
  approved_at?: string;
  approval_comment?: string;
  created_at: string;
  is_reviewer: boolean;
  can_approve: boolean;
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
  const workflowStore = useWorkflow();
  // state
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [loadingRequests, setLoadingRequests] = useState<Set<string>>(new Set());
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "priority">("newest");
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "my_review">("my_review");
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [showPageSizeOptions, setShowPageSizeOptions] = useState(false);

  // fetch approval requests
  const fetchApprovalRequests = async () => {
    if (!workspaceSlug || !projectId) return;

    try {
      setLoading(true);
      const response = await workflowStore.getApprovalRequests(
        workspaceSlug as string,
        projectId as string,
        currentPage,
        itemsPerPage,
        filterStatus,
        searchTerm,
        sortOrder
      );
      setApprovalRequests(response.results || []);
      setTotalCount(response.count || 0);
      setTotalPages(response.total_pages || 0);
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
  }, [isOpen, workspaceSlug, projectId, currentPage, itemsPerPage, filterStatus, searchTerm, sortOrder]);

  // Close page size options when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showPageSizeOptions && !(event.target as Element).closest("[data-page-size-selector]")) {
        setShowPageSizeOptions(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showPageSizeOptions]);

  const handleApprove = async (approvalRequestId: string, approvalComment: string = "") => {
    if (!workspaceSlug || !projectId) return;

    try {
      setProcessingIds((prev) => new Set(prev).add(approvalRequestId));

      await workflowStore.approveTransition(workspaceSlug as string, projectId as string, approvalRequestId, {
        comment: approvalComment,
      });

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
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(approvalRequestId);
        return newSet;
      });
    }
  };

  const handleReject = async (approvalRequestId: string, rejectionComment: string = "") => {
    try {
      if (!workspaceSlug || !projectId) return;

      setLoadingRequests((prev) => new Set(prev).add(approvalRequestId));

      await workflowStore.rejectTransition(workspaceSlug?.toString(), projectId?.toString(), approvalRequestId, {
        comment: rejectionComment,
      });

      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "거부 완료",
        message: "상태 전환이 거부되었습니다.",
      });

      // Refresh approval requests
      fetchApprovalRequests();

      // Clear the comment for this request
      setComments((prev) => {
        const newComments = { ...prev };
        delete newComments[approvalRequestId];
        return newComments;
      });
    } catch (error) {
      console.error("Error rejecting transition:", error);
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "거부 실패",
        message: "상태 전환 거부에 실패했습니다.",
      });
    } finally {
      setLoadingRequests((prev) => {
        const newSet = new Set(prev);
        newSet.delete(approvalRequestId);
        return newSet;
      });
    }
  };

  // Data is already filtered and sorted by the backend, so use it directly
  const paginatedRequests = approvalRequests;

  // Reset to first page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, sortOrder]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
    setShowPageSizeOptions(false);
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={onClose} position={EModalPosition.CENTER} width={EModalWidth.VIIXL}>
      <div className="p-6" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-custom-text-100">워크플로우 승인 요청 ({totalCount}개)</h3>
            {totalPages > 1 && (
              <div className="text-sm text-custom-text-200">
                {currentPage} / {totalPages} 페이지
              </div>
            )}
          </div>
          <p className="text-sm text-custom-text-200 mt-1">
            프로젝트의 모든 상태 전환 승인 요청을 확인하고 처리하세요.
          </p>

          {/* Search and Filter Controls */}
          <div className="mt-4 space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-custom-text-400" />
              <input
                type="text"
                placeholder="이슈 제목, 요청자 이름, 이슈 번호로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-custom-border-200 rounded-lg bg-custom-background-100 text-custom-text-100 placeholder-custom-text-400 focus:outline-none focus:ring-2 focus:ring-custom-primary-100 focus:border-custom-primary-100"
              />
            </div>

            {/* Filter and Sort Controls */}
            <div className="flex flex-wrap gap-3">
              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-custom-text-400" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as "all" | "pending" | "my_review")}
                  className="px-3 py-1 border border-custom-border-200 rounded bg-custom-background-100 text-custom-text-100 text-sm focus:outline-none focus:ring-2 focus:ring-custom-primary-100"
                >
                  <option value="my_review">내가 검토할 것</option>
                  <option value="pending">대기 중</option>
                  <option value="all">전체</option>
                </select>
              </div>

              {/* Sort Order */}
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-custom-text-400" />
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as "newest" | "oldest" | "priority")}
                  className="px-3 py-1 border border-custom-border-200 rounded bg-custom-background-100 text-custom-text-100 text-sm focus:outline-none focus:ring-2 focus:ring-custom-primary-100"
                >
                  <option value="newest">최신순</option>
                  <option value="oldest">오래된순</option>
                  <option value="priority">우선순위</option>
                </select>
              </div>

              {/* Page Size Setting */}
              <div className="flex items-center gap-2 relative" data-page-size-selector>
                <Settings className="h-4 w-4 text-custom-text-400" />
                <button
                  onClick={() => setShowPageSizeOptions(!showPageSizeOptions)}
                  className="px-3 py-1 border border-custom-border-200 rounded bg-custom-background-100 text-custom-text-100 text-sm focus:outline-none focus:ring-2 focus:ring-custom-primary-100 hover:bg-custom-background-80"
                >
                  {itemsPerPage}개씩 보기
                </button>
                {showPageSizeOptions && (
                  <div className="absolute top-full left-0 mt-1 z-50 bg-custom-background-100 border border-custom-border-200 rounded-lg shadow-lg">
                    {[5, 10, 20, 50].map((size) => (
                      <button
                        key={size}
                        onClick={() => handleItemsPerPageChange(size)}
                        className={`block w-full px-4 py-2 text-left text-sm hover:bg-custom-background-80 first:rounded-t-lg last:rounded-b-lg ${
                          itemsPerPage === size
                            ? "bg-custom-background-80 text-custom-primary-100"
                            : "text-custom-text-100"
                        }`}
                      >
                        {size}개씩
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-24 bg-custom-background-80 rounded-lg" />
              </div>
            ))}
          </div>
        ) : paginatedRequests.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="h-12 w-12 text-custom-text-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-custom-text-100 mb-2">
              {searchTerm || filterStatus !== "all" ? "검색 결과가 없습니다" : "관련된 승인 요청이 없습니다"}
            </h4>
            <p className="text-custom-text-200">
              {searchTerm || filterStatus !== "all"
                ? "검색 조건을 변경하거나 필터를 조정해보세요."
                : "현재 내가 검토자이거나 요청한 워크플로우 승인 요청이 없습니다."}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              {paginatedRequests.map((request) => (
                <div
                  key={request.id}
                  className="border border-custom-border-200 rounded-lg p-4 bg-custom-background-100"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-custom-text-100">#{request.issue.sequence_id}</span>
                        <span className="text-sm text-custom-text-200">{request.issue.name}</span>
                      </div>

                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="inline-block w-3 h-3 rounded-full"
                          style={{ backgroundColor: request.transition.from_state.color }}
                        />
                        <span className="text-sm text-custom-text-200">{request.transition.from_state.name}</span>
                        <span className="text-custom-text-400">→</span>
                        <span
                          className="inline-block w-3 h-3 rounded-full"
                          style={{ backgroundColor: request.transition.to_state.color }}
                        />
                        <span className="text-sm text-custom-text-200">{request.transition.to_state.name}</span>
                      </div>

                      <div className="flex items-center gap-2 mb-2">
                        <User className="h-4 w-4 text-custom-text-400" />
                        <span className="text-xs text-custom-text-400">요청자:</span>
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-custom-text-200">{request.requester.display_name}</span>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-custom-text-400">상태:</span>
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            request.status === "pending"
                              ? "bg-yellow-100 text-yellow-800"
                              : request.status === "approved"
                                ? "bg-green-100 text-green-800"
                                : request.status === "rejected"
                                  ? "bg-red-100 text-red-800"
                                  : request.status === "cancelled"
                                    ? "bg-gray-100 text-gray-800"
                                    : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {request.status === "pending"
                            ? "승인 대기"
                            : request.status === "approved"
                              ? "승인됨"
                              : request.status === "rejected"
                                ? "거부됨"
                                : request.status === "cancelled"
                                  ? "취소됨"
                                  : request.status}
                        </span>
                      </div>

                      {/* Reviewers */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-custom-text-400">검토자:</span>
                        <div className="flex flex-wrap gap-1">
                          {request.reviewers.map((reviewer) => (
                            <span
                              key={reviewer.id}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-custom-background-80 text-custom-text-200"
                            >
                              {reviewer.display_name}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Approval Info */}
                      {request.approved_by && (
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-xs text-custom-text-400">승인자:</span>
                          <span className="text-sm text-custom-text-200">{request.approved_by.display_name}</span>
                          {request.approved_at && (
                            <span className="text-xs text-custom-text-400">
                              ({new Date(request.approved_at).toLocaleString()})
                            </span>
                          )}
                        </div>
                      )}

                      {/* Role indicator */}
                      {request.is_reviewer && (
                        <div className="flex items-center gap-2 mb-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                            🔍 검토자
                          </span>
                        </div>
                      )}

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
                    {request.status === "pending" && request.can_approve ? (
                      // Show approval actions only for pending requests where user can approve
                      selectedRequest === request.id ? (
                        <div className="space-y-3">
                          <TextArea
                            placeholder="승인/거부 사유를 입력하세요 (필수)"
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
                              disabled={!comment.trim()}
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
                              disabled={!comment.trim()}
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
                            className="flex items-center gap-1"
                          >
                            <MessageSquare className="h-4 w-4" />
                            검토 및 승인/거부
                          </Button>
                        </div>
                      )
                    ) : request.status === "pending" && !request.can_approve ? (
                      // Show info message for pending requests where user cannot approve
                      <div className="text-sm text-custom-text-400">
                        {request.is_reviewer
                          ? "승인 권한이 없습니다."
                          : "승인 대기 중입니다. 검토자가 승인을 검토할 예정입니다."}
                      </div>
                    ) : (
                      // Show final status for non-pending requests
                      <div className="flex items-center gap-2">
                        {request.status === "approved" && (
                          <span className="text-sm text-green-600 flex items-center gap-1">
                            <CheckCircle className="h-4 w-4" />
                            승인 완료
                          </span>
                        )}
                        {request.status === "rejected" && (
                          <span className="text-sm text-red-600 flex items-center gap-1">
                            <XCircle className="h-4 w-4" />
                            거부됨
                          </span>
                        )}
                        {request.status === "cancelled" && <span className="text-sm text-gray-600">취소됨</span>}
                        {request.approval_comment && (
                          <div className="ml-4 text-sm text-custom-text-300">💬 {request.approval_comment}</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-custom-border-200">
                <div className="text-sm text-custom-text-200">
                  {totalCount > 0 && (
                    <>
                      {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, totalCount)} /{" "}
                      {totalCount}개
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Previous Page */}
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className="flex items-center gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    이전
                  </Button>

                  {/* Page Numbers */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }

                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "primary" : "outline-primary"}
                          size="sm"
                          onClick={() => handlePageChange(pageNum)}
                          className="min-w-[32px] px-2"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>

                  {/* Next Page */}
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    className="flex items-center gap-1"
                  >
                    다음
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-custom-border-200">
          <Button variant="neutral-primary" onClick={onClose}>
            닫기
          </Button>
          <Button variant="outline-primary" size="sm" onClick={fetchApprovalRequests} disabled={loading}>
            새로고침
          </Button>
        </div>
      </div>
    </ModalCore>
  );
});
