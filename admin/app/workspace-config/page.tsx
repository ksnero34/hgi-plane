"use client";

import { useState, useEffect } from "react";
import { observer } from "mobx-react";
import { PlusIcon, X } from "lucide-react";

// components
import {
  Button,
  Loader,
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
    setIsAddModalOpen(false);
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

      {/* 추가/수정 모달 */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-custom-background-100 rounded-lg shadow-lg w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-custom-border-200">
              <h3 className="text-lg font-medium">
                {selectedWorkspaceConfig ? "워크스페이스 구성 수정" : "새 워크스페이스 구성 추가"}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-custom-text-300 hover:text-custom-text-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5">
              <WorkspaceForm
                handleFormSubmit={handleFormSubmit}
                handleClose={() => setIsAddModalOpen(false)}
                selectedWorkspaceConfig={selectedWorkspaceConfig}
                workspaces={workspaces}
              />
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-custom-background-100 rounded-lg shadow-lg w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-custom-border-200">
              <h3 className="text-lg font-medium">워크스페이스 구성 삭제</h3>
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="text-custom-text-300 hover:text-custom-text-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-custom-text-300">
                이 워크스페이스 구성을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
              </p>
              <div className="flex justify-end gap-2">
                <Button 
                  variant="neutral-primary" 
                  onClick={() => setIsDeleteModalOpen(false)}
                >
                  취소
                </Button>
                <Button 
                  variant="danger" 
                  onClick={handleDeleteConfirm}
                >
                  삭제
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default WorkspaceConfigPage; 