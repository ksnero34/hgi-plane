import { useContext } from "react";
import { TOAST_TYPE, setToast } from "@plane/ui";
import { StoreContext } from "@/lib/store-provider";

export const useWorkspaceConfig = () => {
  const { workspaceConfig } = useContext(StoreContext);

  const fetchWorkspaceConfigs = async () => {
    try {
      return await workspaceConfig.fetchConfigs();
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "워크스페이스 설정 불러오기 실패",
        message: "워크스페이스 설정을 불러오는데 실패했습니다."
      });
      console.error("Error fetching workspace configs:", error);
      throw error;
    }
  };

  const fetchWorkspaces = async () => {
    try {
      return await workspaceConfig.fetchWorkspaces();
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "워크스페이스 목록 불러오기 실패",
        message: "워크스페이스 목록을 불러오는데 실패했습니다."
      });
      console.error("Error fetching workspaces:", error);
      throw error;
    }
  };

  const createWorkspaceConfig = async (data: any) => {
    try {
      const result = await workspaceConfig.createConfig(data);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "워크스페이스 설정 추가 완료",
        message: "워크스페이스 설정이 성공적으로 추가되었습니다."
      });
      return result;
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "워크스페이스 설정 추가 실패",
        message: "워크스페이스 설정을 추가하는데 실패했습니다."
      });
      console.error("Error creating workspace config:", error);
      throw error;
    }
  };

  const updateWorkspaceConfig = async (id: string, data: any) => {
    try {
      const result = await workspaceConfig.updateConfig(id, data);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "워크스페이스 설정 업데이트 완료",
        message: "워크스페이스 설정이 성공적으로 업데이트되었습니다."
      });
      return result;
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "워크스페이스 설정 업데이트 실패",
        message: "워크스페이스 설정을 업데이트하는데 실패했습니다."
      });
      console.error("Error updating workspace config:", error);
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
      return true;
    } catch (error) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "워크스페이스 설정 삭제 실패",
        message: "워크스페이스 설정을 삭제하는데 실패했습니다."
      });
      console.error("Error deleting workspace config:", error);
      throw error;
    }
  };

  return {
    workspaceConfigs: workspaceConfig.configs,
    workspaces: workspaceConfig.workspaces,
    isLoading: workspaceConfig.isLoading,
    error: workspaceConfig.error,
    fetchWorkspaceConfigs,
    fetchWorkspaces,
    createWorkspaceConfig,
    updateWorkspaceConfig,
    deleteWorkspaceConfig
  };
}; 