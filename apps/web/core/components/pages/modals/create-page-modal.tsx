import type { FC } from "react";
import { useEffect, useState } from "react";
// constants
import type { EPageAccess } from "@plane/constants";
import { PROJECT_PAGE_TRACKER_EVENTS } from "@plane/constants";
import type { TPage } from "@plane/types";
// ui
import { EModalPosition, EModalWidth, ModalCore } from "@plane/ui";
// hooks
import { captureSuccess, captureError } from "@/helpers/event-tracker.helper";
import { useAppRouter } from "@/hooks/use-app-router";
// plane web hooks
import type { EPageStoreType } from "@/plane-web/hooks/store";
import { usePageStore } from "@/plane-web/hooks/store";
// local imports
import { PageForm } from "./page-form";

type Props = {
  workspaceSlug: string;
  projectId: string;
  isModalOpen: boolean;
  pageAccess?: EPageAccess;
  isFolder?: boolean;
  parentFolderId?: string | null;
  handleModalClose: () => void;
  redirectionEnabled?: boolean;
  storeType: EPageStoreType;
};

export function CreatePageModal(props: Props) {
  const {
    workspaceSlug,
    projectId,
    isModalOpen,
    pageAccess,
    isFolder,
    parentFolderId,
    handleModalClose,
    redirectionEnabled = false,
    storeType,
  } = props;
  // states
  const [pageFormData, setPageFormData] = useState<Partial<TPage>>({
    id: undefined,
    name: "",
    logo_props: undefined,
    parent: parentFolderId || null,
    is_folder: isFolder,
  });
  // router
  const router = useAppRouter();
  // store hooks
  const { createPage } = usePageStore(storeType);
  const handlePageFormData = <T extends keyof TPage>(key: T, value: TPage[T]) =>
    setPageFormData((prev) => ({ ...prev, [key]: value }));

  // update page access in form data when page access from the store changes
  useEffect(() => {
    setPageFormData((prev) => ({ ...prev, access: pageAccess }));
  }, [pageAccess]);

  useEffect(() => {
    setPageFormData((prev) => ({ ...prev, is_folder: isFolder }));
  }, [isFolder]);

  // update parent folder in form data when parentFolderId changes
  useEffect(() => {
    setPageFormData((prev) => ({ ...prev, parent: parentFolderId || null }));
  }, [parentFolderId]);

  const handleStateClear = () => {
    setPageFormData({ id: undefined, name: "", access: pageAccess, parent: null, is_folder: isFolder });
    handleModalClose();
  };

  const handleFormSubmit = async () => {
    if (!workspaceSlug || !projectId) return;

    console.log("handleFormSubmit - pageFormData:", pageFormData);

    try {
      const pageData = await createPage(pageFormData);
      if (pageData) {
        captureSuccess({
          eventName: PROJECT_PAGE_TRACKER_EVENTS.create,
          payload: {
            id: pageData.id,
          },
        });
        handleStateClear();

        // 폴더인 경우와 페이지인 경우 다른 리다이렉션 처리
        if (redirectionEnabled) {
          if (pageData.is_folder) {
            // 폴더인 경우 해당 폴더 내부로 이동
            router.push(`/${workspaceSlug}/projects/${projectId}/pages/?folder=${pageData.id}`);
          } else {
            // 페이지인 경우 페이지 편집 화면으로 이동
            router.push(`/${workspaceSlug}/projects/${projectId}/pages/${pageData.id}`);
          }
        }
      }
    } catch (error: any) {
      captureError({
        eventName: PROJECT_PAGE_TRACKER_EVENTS.create,
        error,
      });
    }
  };

  return (
    <ModalCore
      isOpen={isModalOpen}
      handleClose={handleModalClose}
      position={EModalPosition.TOP}
      width={EModalWidth.XXL}
    >
      <PageForm
        formData={pageFormData}
        handleFormData={handlePageFormData}
        handleModalClose={handleStateClear}
        handleFormSubmit={handleFormSubmit}
      />
    </ModalCore>
  );
}
