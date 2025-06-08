// store types
import { useState } from "react";
import { observer } from "mobx-react";
import { Button, CustomSearchSelect, ModalCore } from "@plane/ui";
import type { ICustomSearchSelectOption } from "@plane/types";
// hooks
import { EPageStoreType, usePageStore } from "@/plane-web/hooks/store";
// store types
import { TPageInstance } from "@/store/pages/base-page";

export type TMovePageModalProps = {
  isOpen: boolean;
  onClose: () => void;
  page: TPageInstance;
};

export const MovePageModal: React.FC<TMovePageModalProps> = observer((props) => {
  const { isOpen, onClose, page } = props;
  const { getFolderPages } = usePageStore(EPageStoreType.PROJECT);
  const [selectedParent, setSelectedParent] = useState<string | null>(page.parent ?? null);

  if (!page) return null;

  const folderOptions: ICustomSearchSelectOption[] = getFolderPages()
    .filter((f) => f.id !== page.id)
    .map((folder) => ({
      value: folder.id,
      query: folder.name || "",
      content: folder.name || "Untitled",
    }));
  folderOptions.unshift({ value: null, query: "root", content: "Root" });

  const handleMove = async () => {
    await page.moveToFolder(selectedParent);
    onClose();
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={onClose}>
      <div className="space-y-5 p-5">
        <h3 className="text-xl font-medium text-custom-text-200">Move Page</h3>
        <CustomSearchSelect
          value={selectedParent}
          onChange={(val: string | null) => setSelectedParent(val)}
          options={folderOptions}
          label={
            folderOptions.find((o) => o.value === selectedParent)?.content ||
            "Root"
          }
          optionsClassName="max-w-48"
          placement="bottom-end"
        />
      </div>
      <div className="px-5 py-4 flex items-center justify-end gap-2 border-t-[0.5px] border-custom-border-200">
        <Button variant="neutral-primary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" onClick={handleMove}>
          Move
        </Button>
      </div>
    </ModalCore>
  );
});
