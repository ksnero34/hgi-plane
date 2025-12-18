import { observer } from "mobx-react";
import { useSearchParams } from "next/navigation";
// components
import { CycleCreateUpdateModal } from "@/components/cycles/modal";
import { CreateUpdateModuleModal } from "@/components/modules";
import { CreatePageModal } from "@/components/pages/modals/create-page-modal";
import { CreateUpdateProjectViewModal } from "@/components/views/modal";
// hooks
import { useCommandPalette } from "@/hooks/store/use-command-palette";
// plane web hooks
import { EPageStoreType } from "@/plane-web/hooks/store";

export type TProjectLevelModalsProps = {
  workspaceSlug: string;
  projectId: string;
};

export const ProjectLevelModals = observer(function ProjectLevelModals(props: TProjectLevelModalsProps) {
  const { workspaceSlug, projectId } = props;
  // router
  const searchParams = useSearchParams();
  const currentFolderId = searchParams.get("folder");
  // store hooks
  const {
    isCreateCycleModalOpen,
    toggleCreateCycleModal,
    isCreateModuleModalOpen,
    toggleCreateModuleModal,
    isCreateViewModalOpen,
    toggleCreateViewModal,
    createPageModal,
    toggleCreatePageModal,
  } = useCommandPalette();

  return (
    <>
      <CycleCreateUpdateModal
        isOpen={isCreateCycleModalOpen}
        handleClose={() => toggleCreateCycleModal(false)}
        workspaceSlug={workspaceSlug.toString()}
        projectId={projectId.toString()}
      />
      <CreateUpdateModuleModal
        isOpen={isCreateModuleModalOpen}
        onClose={() => toggleCreateModuleModal(false)}
        workspaceSlug={workspaceSlug.toString()}
        projectId={projectId.toString()}
      />
      <CreateUpdateProjectViewModal
        isOpen={isCreateViewModalOpen}
        onClose={() => toggleCreateViewModal(false)}
        workspaceSlug={workspaceSlug.toString()}
        projectId={projectId.toString()}
      />
      <CreatePageModal
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        isModalOpen={createPageModal.isOpen}
        pageAccess={createPageModal.pageAccess}
        isFolder={createPageModal.isFolder}
        parentFolderId={createPageModal.parentFolderId || currentFolderId}
        redirectionEnabled={createPageModal.redirectionEnabled}
        handleModalClose={() => toggleCreatePageModal({ isOpen: false })}
        storeType={EPageStoreType.PROJECT}
      />
    </>
  );
});
