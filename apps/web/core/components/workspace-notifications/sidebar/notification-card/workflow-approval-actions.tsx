import { useState } from "react";
// ui
import { Button, TextArea } from "@plane/ui";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
// hooks
import { useWorkflow } from "@/hooks/store/use-workflow";

type Props = {
  workspaceSlug: string;
  projectId: string;
  approvalRequestId: string;
  initialStatus?: string;
};

export const NotificationWorkflowApprovalActions = ({
  workspaceSlug,
  projectId,
  approvalRequestId,
  initialStatus,
}: Props) => {
  const { approveTransition, rejectTransition } = useWorkflow();
  const [mode, setMode] = useState<"approve" | "reject" | null>(null);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [completedAction, setCompletedAction] = useState<"approved" | "rejected" | null>(null);

  const handleSubmit = async () => {
    if (!mode) return;
    setLoading(true);
    try {
      if (mode === "approve") {
        await approveTransition(workspaceSlug, projectId, approvalRequestId, { comment });
        setToast({
          type: TOAST_TYPE.SUCCESS,
          title: "승인 완료",
          message: "상태 전환이 승인되어 실행되었습니다.",
        });
        setCompletedAction("approved");
      } else {
        await rejectTransition(workspaceSlug, projectId, approvalRequestId, { comment });
        setToast({
          type: TOAST_TYPE.SUCCESS,
          title: "거절 완료",
          message: "상태 전환 요청이 거절되었습니다.",
        });
        setCompletedAction("rejected");
      }
      setMode(null);
      setComment("");
    } catch (error: any) {
      console.error(error);
      const errorMessage = error?.response?.data?.error || "요청 처리에 실패했습니다.";
      
      if (errorMessage.includes("already") || errorMessage.includes("processed")) {
         setToast({
          type: TOAST_TYPE.INFO,
          title: "이미 처리됨",
          message: "이미 처리된 요청입니다.",
        });
        // Optimistically set to completed if we can guess, or just hide buttons?
        // For now, let's just close the mode
        setMode(null);
      } else {
        setToast({
          type: TOAST_TYPE.ERROR,
          title: "오류",
          message: errorMessage,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  if (completedAction || (initialStatus && initialStatus !== "pending")) {
    const status = completedAction || (initialStatus === "approved" ? "approved" : "rejected");
    return (
      <div
        className={`mt-2 text-sm font-medium ${status === "approved" ? "text-custom-primary-100" : "text-red-500"}`}
      >
        {status === "approved" ? "승인됨" : "거절됨"}
      </div>
    );
  }

  if (mode) {
    return (
      <div
        className="mt-2 p-3 bg-custom-background-90 rounded-md border border-custom-border-200 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 text-sm font-medium text-custom-text-100">
          {mode === "approve" ? "승인 사유 (선택)" : "거절 사유 (선택)"}
        </div>
        <TextArea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full min-h-[60px] bg-custom-background-100"
          placeholder="코멘트를 입력하세요..."
          name="approval-comment"
        />
        <div className="flex justify-end gap-2 mt-2">
          <Button
            variant="neutral-primary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setMode(null);
            }}
            disabled={loading}
          >
            취소
          </Button>
          <Button
            variant={mode === "approve" ? "primary" : "danger"}
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleSubmit();
            }}
            loading={loading}
          >
            {mode === "approve" ? "승인하기" : "거절하기"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 mt-2 pt-1">
      <Button
        variant="primary"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          setMode("approve");
        }}
      >
        승인
      </Button>
      <Button
        variant="danger"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          setMode("reject");
        }}
      >
        거절
      </Button>
    </div>
  );
};
