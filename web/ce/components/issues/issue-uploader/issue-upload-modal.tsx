import { FC } from "react";
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
            />
            <label htmlFor="file-upload">
              <Button variant="primary" className="cursor-pointer">
                {t("issue.upload.select_file")}
              </Button>
            </label>
          </div>
        </div>
      </div>
    </ModalCore>
  );
});
