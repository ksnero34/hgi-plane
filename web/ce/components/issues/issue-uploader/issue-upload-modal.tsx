import { FC } from "react";
import { observer } from "mobx-react";
import { useTranslation } from "@plane/i18n";
import { Button, ModalCore, EModalWidth, EModalPosition } from "@plane/ui";

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
      position={EModalPosition.CENTER}
      width={EModalWidth.MD}
    >
      <div className="p-4">
        <div className="mb-4">
          <p className="text-sm text-custom-text-300">
            {t("issue.upload.description")}
          </p>
        </div>
        <div className="flex items-center justify-center">
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button variant="primary">
              {t("issue.upload.select_file")}
            </Button>
          </label>
        </div>
      </div>
    </ModalCore>
  );
});
