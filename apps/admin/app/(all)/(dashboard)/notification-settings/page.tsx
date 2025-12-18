import { useEffect, useState } from "react";
import axios from "axios";
import { observer } from "mobx-react";
import { Loader } from "@plane/ui";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { useAuth } from "@/hooks/store/use-user";
import { CreateConfigModal } from "./components/create-config-modal";
import { NotificationConfigList } from "./components/notification-config-list";
import { NotificationTemplateList } from "./components/notification-template-list";
import { TestNotificationModal } from "./components/test-notification-modal";

export interface INotificationConfig {
  id: string;
  name: string;
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
  endpoint_url: string;
  method: string;
  headers: Record<string, string>;
  json_template: Record<string, any>;
  is_enabled: boolean;
  timeout: number;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

export interface INotificationTemplate {
  id: string;
  name: string;
  description: string;
  service_type: string;
  endpoint_url: string;
  method: string;
  headers: Record<string, string>;
  json_template: Record<string, any>;
  is_system_template: boolean;
  created_at: string;
  updated_at: string;
}

export interface INotificationLog {
  id: string;
  config: string;
  config_name: string;
  request_data: Record<string, any>;
  response_data: Record<string, any>;
  status_code: number;
  success: boolean;
  error_message: string;
  attempt_count: number;
  created_at: string;
}

export interface IWorkspace {
  id: string;
  name: string;
  slug: string;
}

interface ApiError {
  response?: {
    status: number;
  };
}

function NotificationSettingsPage() {
  const { isAdmin, isLoading: authLoading } = useAuth();

  const [configs, setConfigs] = useState<INotificationConfig[]>([]);
  const [templates, setTemplates] = useState<INotificationTemplate[]>([]);
  const [workspaces, setWorkspaces] = useState<IWorkspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<"configs" | "templates">("configs");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [selectedConfig] = useState<INotificationConfig | null>(null);

  // 경로에서 '/god-mode' 접두사를 제거하는 함수
  const getNormalizedPath = (path: string) => path.replace(/^\/god-mode/, "");

  // 인증 오류 처리 함수
  const handleAuthError = () => {
    console.log("Notification-settings 페이지: 인증 오류 발생, 리다이렉션 실행");
    window.location.replace(`/god-mode/?next_path=/notification-settings`);
  };

  // 직접 인스턴스 관리자 API 호출로 인증 체크
  useEffect(() => {
    console.log("Notification-settings 페이지: 직접 API 호출로 인증 체크");
    axios
      .get("/api/instances/admins/", { withCredentials: true })
      .then((response) => {
        console.log("Notification-settings 페이지: 관리자 API 호출 성공", response.data);
      })
      .catch((error) => {
        console.log("Notification-settings 페이지: 관리자 API 호출 오류", error);
        if (error.response && error.response.status === 401) {
          const currentPath = window.location.pathname;
          const normalizedPath = currentPath.replace(/^\/god-mode/, "");
          window.location.replace(`/god-mode/?next_path=${normalizedPath}`);
        }
      });
  }, []);

  // 워크스페이스 목록 로드
  const fetchWorkspaces = async () => {
    try {
      const response = await axios.get("/api/instances/workspaces/", { withCredentials: true });
      const workspaceData = response.data.results || [];
      setWorkspaces(workspaceData);
      if (workspaceData.length > 0 && !selectedWorkspace) {
        setSelectedWorkspace(workspaceData[0].slug);
      }
    } catch (error) {
      console.error("워크스페이스 로드 오류:", error);
      const apiError = error as ApiError;
      if (apiError?.response?.status === 401) {
        handleAuthError();
      }
    }
  };

  // 알림 설정 목록 로드
  const fetchConfigs = async (workspaceSlug: string) => {
    if (!workspaceSlug) return;

    try {
      const response = await axios.get(`/api/instances/workspaces/${workspaceSlug}/rest-notification-configs/`, {
        withCredentials: true,
      });
      console.log("Configs API response:", response.data);
      // API 응답이 배열이면 직접 사용, 객체면 results 속성 사용
      const configsData = Array.isArray(response.data) ? response.data : response.data.results || [];
      setConfigs(configsData);
    } catch (error) {
      console.error("알림 설정 로드 오류:", error);
      const apiError = error as ApiError;
      if (apiError?.response?.status === 401) {
        handleAuthError();
      }
    }
  };

  // 템플릿 목록 로드
  const fetchTemplates = async () => {
    try {
      const response = await axios.get("/api/instances/notification-templates/", { withCredentials: true });
      console.log("Templates API response:", response.data);
      // API 응답이 배열이면 직접 사용, 객체면 results 속성 사용
      const templatesData = Array.isArray(response.data) ? response.data : response.data.results || [];
      setTemplates(templatesData);
    } catch (error) {
      console.error("템플릿 로드 오류:", error);
      const apiError = error as ApiError;
      if (apiError?.response?.status === 401) {
        handleAuthError();
      }
    }
  };

  // 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      try {
        console.log("Notification-settings 페이지: 데이터 로딩 시작");
        setIsLoading(true);
        await fetchWorkspaces();
        await fetchTemplates();
        setIsDataLoaded(true);
      } catch (error) {
        console.error("Notification-settings 페이지: 데이터 로드 오류", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (!authLoading && isAdmin && !isDataLoaded) {
      loadData();
    }
  }, [authLoading, isAdmin, isDataLoaded]);

  // 워크스페이스 변경시 알림 설정 로드
  useEffect(() => {
    if (selectedWorkspace) {
      fetchConfigs(selectedWorkspace);
    }
  }, [selectedWorkspace]);

  // 알림 설정 생성
  const handleCreateConfig = async (data: Partial<INotificationConfig>) => {
    try {
      const response = await axios.post(
        `/api/instances/workspaces/${selectedWorkspace}/rest-notification-configs/`,
        data,
        { withCredentials: true }
      );

      setConfigs((prev) => [...prev, response.data]);
      setShowCreateModal(false);

      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "설정 생성 완료",
        message: "알림 설정이 성공적으로 생성되었습니다.",
      });
    } catch (error) {
      console.error("설정 생성 오류:", error);
      const apiError = error as ApiError;
      if (apiError?.response?.status === 401) {
        handleAuthError();
      } else {
        setToast({
          type: TOAST_TYPE.ERROR,
          title: "설정 생성 실패",
          message: "알림 설정 생성에 실패했습니다.",
        });
      }
    }
  };

  // 알림 설정 업데이트
  const handleUpdateConfig = async (configId: string, data: Partial<INotificationConfig>) => {
    try {
      const response = await axios.patch(
        `/api/instances/workspaces/${selectedWorkspace}/rest-notification-configs/${configId}/`,
        data,
        { withCredentials: true }
      );

      setConfigs((prev) => prev.map((config) => (config.id === configId ? response.data : config)));

      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "설정 업데이트 완료",
        message: "알림 설정이 성공적으로 업데이트되었습니다.",
      });
    } catch (error) {
      console.error("설정 업데이트 오류:", error);
      const apiError = error as ApiError;
      if (apiError?.response?.status === 401) {
        handleAuthError();
      } else {
        setToast({
          type: TOAST_TYPE.ERROR,
          title: "설정 업데이트 실패",
          message: "알림 설정 업데이트에 실패했습니다.",
        });
      }
    }
  };

  // 알림 설정 삭제
  const handleDeleteConfig = async (configId: string) => {
    try {
      await axios.delete(`/api/instances/workspaces/${selectedWorkspace}/rest-notification-configs/${configId}/`, {
        withCredentials: true,
      });

      setConfigs((prev) => prev.filter((config) => config.id !== configId));

      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "설정 삭제 완료",
        message: "알림 설정이 성공적으로 삭제되었습니다.",
      });
    } catch (error) {
      console.error("설정 삭제 오류:", error);
      const apiError = error as ApiError;
      if (apiError?.response?.status === 401) {
        handleAuthError();
      } else {
        setToast({
          type: TOAST_TYPE.ERROR,
          title: "설정 삭제 실패",
          message: "알림 설정 삭제에 실패했습니다.",
        });
      }
    }
  };

  // 테스트 알림 전송
  const handleTestNotification = async (configId: string) => {
    try {
      await axios.post(
        `/api/instances/workspaces/${selectedWorkspace}/rest-notification-test/`,
        { config_id: configId },
        { withCredentials: true }
      );

      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "테스트 알림 전송",
        message: "테스트 알림이 성공적으로 전송되었습니다.",
      });
    } catch (error) {
      console.error("테스트 알림 전송 오류:", error);
      const apiError = error as ApiError;
      if (apiError?.response?.status === 401) {
        handleAuthError();
      } else {
        setToast({
          type: TOAST_TYPE.ERROR,
          title: "테스트 알림 전송 실패",
          message: "테스트 알림 전송에 실패했습니다.",
        });
      }
    }
  };

  // 로딩 중일 경우 아무것도 표시하지 않음
  if (authLoading || !isDataLoaded) {
    console.log("Notification-settings 페이지: 로딩 중", { authLoading, isDataLoaded });
    return null;
  }

  return (
    <div className="relative container mx-auto w-full h-full p-4 py-4 space-y-6 flex flex-col">
      <div className="border-b border-custom-border-100 mx-4 py-4 space-y-1 flex-shrink-0">
        <div className="text-xl font-medium text-custom-text-100">알림 설정</div>
        <div className="text-sm font-normal text-custom-text-300">
          REST API 기반 알림 설정을 관리합니다. 워크스페이스별로 알림 설정을 구성하고 테스트할 수 있습니다.
        </div>
      </div>

      {/* 워크스페이스 선택 */}
      <div className="px-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-custom-text-200">워크스페이스:</label>
          <select
            value={selectedWorkspace}
            onChange={(e) => setSelectedWorkspace(e.target.value)}
            className="px-3 py-2 text-sm border border-custom-border-200 rounded-md bg-custom-background-100 text-custom-text-100"
          >
            <option value="">워크스페이스 선택</option>
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.slug}>
                {workspace.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 탭 선택 */}
      <div className="px-4">
        <div className="flex border-b border-custom-border-200">
          <button
            onClick={() => setActiveTab("configs")}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === "configs"
                ? "border-custom-primary-100 text-custom-primary-100"
                : "border-transparent text-custom-text-400 hover:text-custom-text-300"
            }`}
          >
            알림 설정
          </button>
          <button
            onClick={() => setActiveTab("templates")}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === "templates"
                ? "border-custom-primary-100 text-custom-primary-100"
                : "border-transparent text-custom-text-400 hover:text-custom-text-300"
            }`}
          >
            템플릿 관리
          </button>
        </div>
      </div>

      <div className="flex-grow overflow-hidden overflow-y-scroll vertical-scrollbar scrollbar-md px-4">
        {isLoading ? (
          <Loader className="w-6 h-6">
            <Loader.Item width="100%" height="100%" />
          </Loader>
        ) : (
          <>
            {activeTab === "configs" && (
              <NotificationConfigList
                configs={configs}
                selectedWorkspace={selectedWorkspace}
                onUpdate={handleUpdateConfig}
                onDelete={handleDeleteConfig}
                onTest={handleTestNotification}
                onCreateNew={() => setShowCreateModal(true)}
              />
            )}
            {activeTab === "templates" && <NotificationTemplateList templates={templates} onRefresh={fetchTemplates} />}
          </>
        )}
      </div>

      {/* 모달들 */}
      {showCreateModal && (
        <CreateConfigModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateConfig}
          templates={templates}
          workspaces={workspaces}
          selectedWorkspace={selectedWorkspace}
        />
      )}

      {showTestModal && selectedConfig && (
        <TestNotificationModal
          isOpen={showTestModal}
          onClose={() => setShowTestModal(false)}
          config={selectedConfig}
          onTest={handleTestNotification}
        />
      )}
    </div>
  );
}

export default observer(NotificationSettingsPage);
