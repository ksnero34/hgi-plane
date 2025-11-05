import { useContext, useEffect } from "react";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { StoreContext } from "@/lib/store-provider";

export const useWorkspaceConfig = () => {
  const { workspaceConfig } = useContext(StoreContext);

  useEffect(() => {
    console.log("워크스페이스 설정 초기 로딩 시작");
    workspaceConfig.fetchConfigs()
      .then(() => {
        console.log("초기 워크스페이스 설정 로드 성공");
      })
      .catch((error) => {
        console.error("초기 워크스페이스 설정 로드 실패:", error);
      });
  }, []); // 컴포넌트 마운트 시에만 실행

  const fetchWorkspaceConfigs = async () => {
    try {
      console.log("수동 워크스페이스 설정 로드 시작");
      const result = await workspaceConfig.fetchConfigs();
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "워크스페이스 설정 불러오기 성공",
        message: "워크스페이스 설정을 성공적으로 불러왔습니다."
      });
      return result;
    } catch (error) {
      console.error("워크스페이스 설정 로드 실패:", error);
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "워크스페이스 설정 불러오기 실패",
        message: "워크스페이스 설정을 불러오는데 실패했습니다."
      });
      throw error;
    }
  };

  const createWorkspaceConfig = async (data: { workspace_id: string; role: number }) => {
    try {
      await workspaceConfig.createConfig(data);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "워크스페이스 설정 추가 완료",
        message: "워크스페이스 설정이 성공적으로 추가되었습니다."
      });
    } catch (error) {
      console.error("Error creating workspace config:", error);
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "워크스페이스 설정 추가 실패",
        message: "워크스페이스 설정을 추가하는데 실패했습니다."
      });
      throw error;
    }
  };

  const updateWorkspaceConfig = async (id: string, data: { role?: number; excluded_user_groups?: string[] }) => {
    try {
      // 요청 데이터 로깅 (디버깅용)
      console.log(`워크스페이스 설정 업데이트 요청 데이터(원본):`, JSON.stringify(data));
      
      // 전달된 데이터 처리 - 항상 두 필드 모두 포함하도록 수정
      const updateData: { role?: number; excluded_user_groups?: string[] } = {
        role: data.role !== undefined ? data.role : undefined,
        excluded_user_groups: Array.isArray(data.excluded_user_groups) ? data.excluded_user_groups : undefined
      };
      
      // null이나 undefined인 필드 제거
      Object.keys(updateData).forEach(key => {
        if (updateData[key as keyof typeof updateData] === undefined) {
          delete updateData[key as keyof typeof updateData];
        }
      });
      
      console.log(`최종 전송 데이터:`, JSON.stringify(updateData));
      
      await workspaceConfig.updateConfig(id, updateData);
      
      // 업데이트 성공 후 목록 갱신
      await fetchWorkspaceConfigs();
      
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "워크스페이스 설정 업데이트 완료",
        message: "워크스페이스 설정이 성공적으로 업데이트되었습니다."
      });
    } catch (error) {
      console.error("워크스페이스 설정 업데이트 실패:", error);
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "워크스페이스 설정 업데이트 실패",
        message: "워크스페이스 설정을 업데이트하는데 실패했습니다."
      });
      throw error;
    }
  };

  const deleteWorkspaceConfig = async (id: string) => {
    try {
      await workspaceConfig.deleteConfig(id);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "워크스페이스 설정 삭제 완료",
        message: "워크스페이스 설정이 성공적으로 삭제되었습니다."
      });
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "워크스페이스 설정 삭제 실패",
        message: "워크스페이스 설정을 삭제하는데 실패했습니다."
      });
      throw error;
    }
  };

  return {
    workspaces: workspaceConfig.workspaces || { results: [] },
    isLoading: workspaceConfig.isLoading,
    error: workspaceConfig.error,
    fetchWorkspaceConfigs,
    createWorkspaceConfig,
    updateWorkspaceConfig,
    deleteWorkspaceConfig
  };
}; 