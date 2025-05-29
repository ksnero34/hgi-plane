import React, { FC, useState } from "react";
import { observer } from "mobx-react";
import { Button, ModalCore, EModalWidth, EModalPosition } from "@plane/ui";
import { useTranslation } from "@plane/i18n";

type TIssueUploadModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File) => Promise<void>;
};

export const IssueUploadModal: FC<TIssueUploadModalProps> = observer((props) => {
  const { isOpen, onClose, onUpload } = props;
  const { t } = useTranslation();
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      try {
        await onUpload(file);
        onClose();
      } catch (error) {
        console.error("Upload failed:", error);
        // 에러는 부모 컴포넌트에서 처리됨
      } finally {
        setIsUploading(false);
      }
    }
  };

  return (
    <ModalCore
      isOpen={isOpen}
      handleClose={onClose}
      position={EModalPosition.TOP}
      width={EModalWidth.MD}
    >
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-xl font-medium mb-2">{t("issue.upload.title")}</h2>
          <p className="text-sm text-custom-text-300">
            {t("issue.upload.description")}
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
              disabled={isUploading}
            />
            <label htmlFor="file-upload">
              <Button 
                variant="primary" 
                className="cursor-pointer"
                disabled={isUploading}
                loading={isUploading}
              >
                {isUploading ? t("issue.upload.uploading") : t("issue.upload.select_file")}
              </Button>
            </label>
          </div>
        </div>
        {isUploading && (
          <div className="mt-4 text-center">
            <p className="text-sm text-custom-text-400">
              {t("issue.upload.uploading")}...
            </p>
          </div>
        )}
      </div>
    </ModalCore>
  );
});
