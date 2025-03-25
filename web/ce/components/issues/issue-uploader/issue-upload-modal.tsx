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
      position={EModalPosition.CENTER}
      width={EModalWidth.MD}
    >
      <div className="p-4">
        <div className="mb-4">
          <p className="text-sm text-custom-text-300">
            Upload a CSV file containing your issues. The file should have the following columns: ID, Project, Parent Issue, Name, Description, State, Start Date, Target Date, Priority, Created By, Assignee, Labels, Cycle Name, Cycle Start Date, Cycle End Date, Module Name, Module Start Date, Module Target Date, Created At, Updated At, Completed At, Archived At.
          </p>
        </div>
        <div className="flex items-center justify-center">
          <div className="relative">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              id="file-upload"
            />
            <label htmlFor="file-upload">
              <Button variant="primary" className="cursor-pointer">
                Select File
              </Button>
            </label>
          </div>
        </div>
      </div>
    </ModalCore>
  );
});
