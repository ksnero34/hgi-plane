import { useState } from "react";
import { AlertTriangle } from "lucide-react";

interface FileDeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  fileName: string | null;
}

export const FileDeleteConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  fileName,
}: FileDeleteConfirmModalProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm();
    } finally {
      setIsLoading(false);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-custom-backdrop transition-opacity" onClick={onClose} />
      <div className="relative z-50 w-full max-w-md rounded-lg bg-custom-background-100 shadow-custom-shadow-md">
        <div className="p-5 flex flex-col sm:flex-row items-center sm:items-start gap-4">
          <span className="flex-shrink-0 grid place-items-center rounded-full size-12 sm:size-10 bg-red-500/20 text-red-500">
            <AlertTriangle className="size-5" aria-hidden="true" />
          </span>
          <div className="text-center sm:text-left">
            <h3 className="text-lg font-medium">파일 삭제</h3>
            <p className="mt-1 text-sm text-custom-text-200">
              <span className="font-bold">{fileName || "파일"}</span> 첨부파일을 삭제하시겠습니까? 이 첨부파일은 영구적으로 삭제되며 복구는 불가능합니다. (Ctrl + Z 로 파일 노드를 복구해도 다운로드는 불가능합니다.)
            </p>
          </div>
        </div>
        <div className="px-5 py-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 border-t-[0.5px] border-custom-border-200">
          <button
            className="rounded px-3 py-1.5 text-sm font-medium text-custom-text-100 bg-custom-background-80 hover:bg-custom-background-90"
            onClick={onClose}
          >
            취소
          </button>
          <button
            className="rounded px-3 py-1.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 disabled:opacity-50"
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? "삭제 중..." : "삭제"}
          </button>
        </div>
      </div>
    </div>
  );
}; 