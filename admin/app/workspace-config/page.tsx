"use client";

import { useState, useEffect } from "react";
import { observer } from "mobx-react";
import { useRouter, usePathname } from "next/navigation";

// components
import { Loader } from "@plane/ui";
import { WorkspaceTable } from "@/components/workspace-config/workspace-table";

// hooks
import { useWorkspaceConfig } from "@/hooks/store/use-workspace-config";
import { useAuth } from "@/hooks/store/use-user";

const WorkspaceConfigPage = observer(() => {
  const router = useRouter();
  const pathname = usePathname();
  const { isAdmin, isLoading: authLoading } = useAuth();
  const { workspaces, isLoading: isConfigLoading, fetchWorkspaceConfigs, createWorkspaceConfig } = useWorkspaceConfig();
  const [dataInitialized, setDataInitialized] = useState(false);

  // 경로에서 '/god-mode' 접두사를 제거하는 함수
  const getNormalizedPath = (path: string) => {
    return path.replace(/^\/god-mode/, '');
  };

  // 인증 오류 처리 함수
  const handleAuthError = () => {
    console.log("인증 오류가 발생했습니다. 로그인 페이지로 리다이렉션합니다.");
    const normalizedPath = getNormalizedPath(pathname);
    window.location.replace(`/god-mode/?next_path=${normalizedPath}`);
  };

  // 에러 확인 유틸리티
  const checkAndLogError = (error: any, context: string): boolean => {
    // 에러 디버깅을 위해 상세 정보 출력
    console.error(`${context} 중 에러 발생:`, error);
    console.log("에러 타입:", typeof error);
    
    try {
      console.log("에러 객체 구조:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    } catch (e) {
      console.log("에러 객체를 JSON으로 변환할 수 없음");
    }
    
    // 모든 속성 출력
    console.log("에러 속성들:");
    for (const prop in error) {
      try {
        console.log(`${prop}:`, error[prop]);
      } catch (e) {
        console.log(`${prop}: [접근 불가능]`);
      }
    }
    
    // 401 상태 확인
    const status401 = 
      error?.response?.status === 401 || 
      error?.status === 401 || 
      (error?.message && error.message.includes("401"));
    
    console.log("401 에러 여부:", status401);
    
    if (status401) {
      console.log("401 에러 감지, 리다이렉션 수행");
      handleAuthError();
    }
    
    return status401;
  };

  // 인증 상태가 변경될 때마다 데이터 초기화 여부 확인
  useEffect(() => {
    if (!authLoading && isAdmin === true && !dataInitialized) {
      console.log("워크스페이스 설정 데이터 초기화 시작");
      loadData();
    }
  }, [authLoading, isAdmin, dataInitialized]);

  const loadData = async () => {
    try {
      await fetchWorkspaceConfigs();
      console.log("데이터 로드 완료");
      setDataInitialized(true);
    } catch (error) {
      console.error("데이터 로드 실패:", error);
      checkAndLogError(error, "워크스페이스 설정 불러오기");
    }
  };

  // 권한 체크 및 데이터 로드
  useEffect(() => {
    if (!authLoading) {
      if (!isAdmin) {
        // 관리자가 아닌 경우 즉시 리다이렉션
        console.log("관리자 권한이 없습니다. 리다이렉션을 수행합니다.");
        const normalizedPath = getNormalizedPath(pathname);
        window.location.replace(`/god-mode/?next_path=${normalizedPath}`);
        return;
      }

      if (!dataInitialized) {
        loadData().catch((error) => {
          checkAndLogError(error, "워크스페이스 설정 불러오기");
        });
      }
    }
  }, [authLoading, isAdmin, dataInitialized]);

  // 로딩 중일 때만 null 반환
  if (authLoading) {
    return null;
  }

  const handleEditWorkspace = (workspaceConfig: any) => {
    // 워크스페이스 역할 변경 처리
    createWorkspaceConfig(workspaceConfig.id, { role: workspaceConfig.role })
      .catch(error => {
        // 401 에러 확인 및 처리
        checkAndLogError(error, "워크스페이스 설정 업데이트");
      });
  };

  const handleDeleteWorkspace = (workspace: any) => {
    // 토글 버튼으로 직접 삭제 처리
    console.log("워크스페이스 설정 삭제:", workspace.id);
    createWorkspaceConfig(workspace.id, { role: workspace.role })
      .catch(error => {
        // 401 에러 확인 및 처리
        checkAndLogError(error, "워크스페이스 설정 삭제");
      });
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
          handleCreateWorkspaceConfig={(...args) => {
            return createWorkspaceConfig(...args)
              .catch(error => {
                // 401 에러 확인 및 처리
                checkAndLogError(error, "워크스페이스 설정 생성");
                throw error;
              });
          }}
        />
      )}
    </div>
  );
});

export default WorkspaceConfigPage; 