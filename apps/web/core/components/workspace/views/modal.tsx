"use client";

import React from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// types
import { GLOBAL_VIEW_TRACKER_EVENTS } from "@plane/constants";
import { IWorkspaceView } from "@plane/types";
// ui
import { EModalPosition, EModalWidth, ModalCore, TOAST_TYPE, setToast } from "@plane/ui";
// components
import { WorkspaceViewForm } from "@/components/workspace";
// constants
// store hooks
import { captureError, captureSuccess } from "@/helpers/event-tracker.helper";
import { useGlobalView } from "@/hooks/store";
import { useAppRouter } from "@/hooks/use-app-router";

type Props = {
  data?: IWorkspaceView;
  isOpen: boolean;
  onClose: () => void;
  preLoadedData?: Partial<IWorkspaceView>;
};

export const CreateUpdateWorkspaceViewModal: React.FC<Props> = observer((props) => {
  const { isOpen, onClose, data, preLoadedData } = props;
  // router
  const router = useAppRouter();
  const { workspaceSlug } = useParams();
  // store hooks
  const { createGlobalView, updateGlobalView } = useGlobalView();

  const handleClose = () => {
    onClose();
  };

  const handleCreateView = async (payload: Partial<IWorkspaceView>) => {
    if (!workspaceSlug) return;

    const payloadData: Partial<IWorkspaceView> = {
      ...payload,
      filters: {
        ...payload?.filters,
      },
    };

    await createGlobalView(workspaceSlug.toString(), payloadData)
      .then((res) => {
        captureSuccess({
          eventName: GLOBAL_VIEW_TRACKER_EVENTS.create,
          payload: {
            id: res.id,
          },
        });
        setToast({
          type: TOAST_TYPE.SUCCESS,
          title: "성공!",
          message: "뷰가 성공적으로 생성되었습니다.",
        });

        router.push(`/${workspaceSlug}/workspace-views/${res.id}`);
        handleClose();
      })
      .catch(() => {
        captureError({
          eventName: GLOBAL_VIEW_TRACKER_EVENTS.create,
        });
        setToast({
          type: TOAST_TYPE.ERROR,
          title: "오류가 발생했습니다!",
          message: "뷰를 생성할 수 없습니다. 다시 시도해주세요.",
        });
      });
  };

  const handleUpdateView = async (payload: Partial<IWorkspaceView>) => {
    if (!workspaceSlug || !data) return;

    const payloadData: Partial<IWorkspaceView> = {
      ...payload,
      query: {
        ...payload?.filters,
      },
    };

    await updateGlobalView(workspaceSlug.toString(), data.id, payloadData)
      .then((res) => {
        if (res) {
          captureSuccess({
            eventName: GLOBAL_VIEW_TRACKER_EVENTS.update,
            payload: {
              id: res.id,
            },
          });
          setToast({
            type: TOAST_TYPE.SUCCESS,
            title: "성공!",
            message: "뷰가 성공적으로 업데이트되었습니다.",
          });
          handleClose();
        }
      })
      .catch(() => {
        captureError({
          eventName: GLOBAL_VIEW_TRACKER_EVENTS.update,
          payload: {
            id: data.id,
          },
        });
        setToast({
          type: TOAST_TYPE.ERROR,
          title: "오류가 발생했습니다!",
          message: "뷰를 업데이트할 수 없습니다. 다시 시도해주세요.",
        });
      });
  };

  const handleFormSubmit = async (formData: Partial<IWorkspaceView>) => {
    if (!workspaceSlug) return;

    if (!data) await handleCreateView(formData);
    else await handleUpdateView(formData);
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={handleClose} position={EModalPosition.TOP} width={EModalWidth.XXL}>
      <WorkspaceViewForm
        handleFormSubmit={handleFormSubmit}
        handleClose={handleClose}
        data={data}
        preLoadedData={preLoadedData}
      />
    </ModalCore>
  );
});
