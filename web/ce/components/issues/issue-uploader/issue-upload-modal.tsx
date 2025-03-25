import { FC } from "react";
import { observer } from "mobx-react";
import { Button, ModalCore, EModalWidth, EModalPosition } from "@plane/ui";

type TIssueUploadModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File) => Promise<void>;
};

export const IssueUploadModal: FC<TIssueUploadModalProps> = observer((props) => {
  const { isOpen, onClose, onUpload } = props;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await onUpload(file);
      onClose();
    }
  };

  return (
    <ModalCore
      isOpen={isOpen}
      handleClose={onClose}
      position={EModalPosition.TOP}
      width={EModalWidth.MD}
    >
      <div className="p-4">
        <div className="mb-4">
          <p className="text-sm text-custom-text-300">
            CSV 혹은 xlsx 파일로 이슈를 업로드 할 수 있습니다.
          </p>
        </div>
        <div className="flex items-center justify-center">
          <div className="relative">
            <input
              type="file"
              accept=".csv, .xlsx"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              id="file-upload"
            />
            <label htmlFor="file-upload">
              <Button variant="primary" className="cursor-pointer">
                파일 선택
              </Button>
            </label>
          </div>
        </div>
      </div>
    </ModalCore>
  );
});
