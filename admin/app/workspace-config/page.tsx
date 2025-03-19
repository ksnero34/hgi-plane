"use client";

import { useState, useEffect } from "react";
import { observer } from "mobx-react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";

// components
import {
  Button,
  Loader,
} from "@plane/ui";
import { WorkspaceTable } from "@/components/workspace-config/workspace-table";

// hooks
import { useWorkspaceConfig } from "@/hooks/store/use-workspace-config";
import { useAuth } from "@/hooks/store/use-user";

const WorkspaceConfigPage = observer(() => {
  // states
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedWorkspaceConfig, setSelectedWorkspaceConfig] = useState<any>(null);
  const [dataInitialized, setDataInitialized] = useState(false);
  const router = useRouter();
  
  // hooks
  const { isAdmin, isLoading: authLoading } = useAuth();
  const {
    workspaces,
    createWorkspaceConfig,
    updateWorkspaceConfig,
    deleteWorkspaceConfig,
    fetchWorkspaceConfigs,
    isLoading: isConfigLoading,
  } = useWorkspaceConfig();

  // 권한 체크
  useEffect(() => {
    // 로딩이 끝나고 관리자가 아니면 로그인 페이지로 리다이렉션
    if (!authLoading && isAdmin === false) {
      console.log("사용자가 관리자가 아닙니다. 로그인 페이지로 리다이렉션합니다.");
      router.push("/");
    }
  }, [authLoading, isAdmin, router]);

  // 한 번만 데이터 로드
  useEffect(() => {
    // 관리자일 때만 데이터를 가져옴
    const loadData = async () => {
      if (!authLoading && isAdmin === true && !dataInitialized) {
        console.log("워크스페이스 설정 데이터를 불러옵니다.");
        try {
          await fetchWorkspaceConfigs();
          setDataInitialized(true);
        } catch (error) {
          console.error("데이터 로딩 중 오류 발생:", error);
          setDataInitialized(true); // 오류가 발생해도 초기화 상태로 설정
        }
      }
    };
    loadData();
  }, [authLoading, isAdmin, dataInitialized, fetchWorkspaceConfigs]);

  // 로딩 중이거나 관리자가 아니면 로딩 표시
  if (authLoading || !isAdmin) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader className="w-10 h-10" />
      </div>
    );
  }

  const handleEditWorkspace = (workspaceConfig: any) => {
    setSelectedWorkspaceConfig(workspaceConfig);
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
      </div>

      {isConfigLoading ? (
        <div className="flex h-full w-full items-center justify-center">
          <Loader className="w-10 h-10" />
        </div>
      ) : (
        <WorkspaceTable
          workspaces={workspaces}
          handleEditWorkspace={handleEditWorkspace}
          handleDeleteWorkspace={handleDeleteWorkspace}
          handleCreateWorkspaceConfig={createWorkspaceConfig}
        />
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