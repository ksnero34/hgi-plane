"use client";

import { useState, useEffect } from "react";
import { observer } from "mobx-react";
import { PlusIcon } from "lucide-react";

// components
import {
  Button,
  Loader,
  Modal,
  ConfirmModal,
} from "@plane/ui";
import { WorkspaceTable } from "@/components/workspace-config/workspace-table";
import { WorkspaceForm } from "@/components/workspace-config/workspace-form";

// hooks
import { useWorkspaceConfig } from "@/hooks/store/use-workspace-config";

const WorkspaceConfigPage = observer(() => {
  // states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedWorkspaceConfig, setSelectedWorkspaceConfig] = useState<any>(null);

  const {
    workspaceConfigs,
    workspaces,
    createWorkspaceConfig,
    updateWorkspaceConfig,
    deleteWorkspaceConfig,
    fetchWorkspaceConfigs,
    fetchWorkspaces,
    isLoading,
  } = useWorkspaceConfig();

  // fetch workspaces and configs on load
  useEffect(() => {
    fetchWorkspaceConfigs();
    fetchWorkspaces();
  }, [fetchWorkspaceConfigs, fetchWorkspaces]);

  const handleAddButtonClick = () => {
    setSelectedWorkspaceConfig(null);
    setIsAddModalOpen(true);
  };

  const handleFormSubmit = async (values: {
    workspace_id: string;
    role: number;
  }) => {
    if (selectedWorkspaceConfig) {
      await updateWorkspaceConfig(selectedWorkspaceConfig.id, values);
    } else {
      await createWorkspaceConfig(values);
    }
  };

  const handleEditWorkspace = (workspaceConfig: any) => {
    setSelectedWorkspaceConfig(workspaceConfig);
    setIsAddModalOpen(true);
  };

  const handleDeleteWorkspace = (workspaceConfig: any) => {
    setSelectedWorkspaceConfig(workspaceConfig);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (selectedWorkspaceConfig) {
      await deleteWorkspaceConfig(selectedWorkspaceConfig.id);
      setIsDeleteModalOpen(false);
    }
  };

  return (
    <div className="px-8 py-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-medium text-custom-text-100">기본 워크스페이스 구성</h2>
          <p className="text-sm text-custom-text-300">
            사용자가 가입할 때 자동으로 추가될 워크스페이스를 구성하세요.
          </p>
        </div>
        <Button
          variant="primary"
          prependIcon={<PlusIcon className="h-3.5 w-3.5" />}
          onClick={handleAddButtonClick}
        >
          새 구성 추가
        </Button>
      </div>

      {isLoading ? (
        <div className="flex h-full w-full items-center justify-center">
          <Loader className="w-10 h-10" />
        </div>
      ) : (
        <WorkspaceTable
          workspaceConfigs={workspaceConfigs}
          handleEditWorkspace={handleEditWorkspace}
          handleDeleteWorkspace={handleDeleteWorkspace}
        />
      )}

      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={selectedWorkspaceConfig ? "워크스페이스 구성 수정" : "새 워크스페이스 구성 추가"}
      >
        <div className="my-4">
          <WorkspaceForm
            handleFormSubmit={handleFormSubmit}
            handleClose={() => setIsAddModalOpen(false)}
            selectedWorkspaceConfig={selectedWorkspaceConfig}
            workspaces={workspaces}
          />
        </div>
      </Modal>

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="워크스페이스 구성 삭제"
        description="이 워크스페이스 구성을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
        confirmButtonText="삭제"
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
});

export default WorkspaceConfigPage; 