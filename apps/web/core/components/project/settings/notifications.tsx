import { useState, useEffect } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Button, Input } from "@plane/ui";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { useProject } from "@/hooks/store/use-project";

// CSRF 토큰을 가져오는 함수
const getCSRFToken = async (): Promise<string> => {
  try {
    const response = await fetch("/auth/get-csrf-token/", {
      credentials: "include",
    });
    const data = await response.json();
    return data.csrf_token;
  } catch (error) {
    console.error("CSRF 토큰 가져오기 실패:", error);
    throw error;
  }
};

export const ProjectNotificationSettings = observer(() => {
  const { workspaceSlug, projectId } = useParams();
  const { currentProjectDetails } = useProject();

  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    is_enabled: false,
    server_url: "",
    bot_token: "",
  });

  useEffect(() => {
    // 초기 데이터 로드
    const fetchMattermostConfig = async () => {
      try {
        const response = await fetch(`/api/workspaces/${workspaceSlug}/projects/${projectId}/mattermost-config/`, {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setFormData(data);
        } else {
          setToast({
            type: TOAST_TYPE.ERROR,
            title: "오류",
            message: "Mattermost 설정을 불러오는데 실패했습니다.",
          });
        }
      } catch (error) {
        console.error("Mattermost 설정 로드 중 오류 발생:", error);
        setToast({
          type: TOAST_TYPE.ERROR,
          title: "오류",
          message: "Mattermost 설정을 불러오는데 실패했습니다.",
        });
      }
    };
    fetchMattermostConfig();
  }, [projectId, workspaceSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // CSRF 토큰 가져오기
      const csrfToken = await getCSRFToken();

      const response = await fetch(`/api/workspaces/${workspaceSlug}/projects/${projectId}/mattermost-config/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken,
        },
        credentials: "include",
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setToast({
          type: TOAST_TYPE.SUCCESS,
          title: "성공",
          message: "Mattermost 알림 설정이 저장되었습니다.",
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || "설정 업데이트 실패");
      }
    } catch (error) {
      console.error("Mattermost 설정 저장 중 오류:", error);
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "오류",
        message: error instanceof Error ? error.message : "Mattermost 알림 설정 저장 중 오류가 발생했습니다.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="px-6 py-6">
      <div className="flex items-center gap-2 border-b border-custom-border-100 pb-3.5">
        <h3 className="text-xl font-medium">Mattermost 알림 설정</h3>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <div className="flex items-center gap-4">
          <input
            type="checkbox"
            checked={formData.is_enabled}
            onChange={(e) => setFormData({ ...formData, is_enabled: e.target.checked })}
            id="enable-mattermost"
          />
          <label htmlFor="enable-mattermost" className="text-sm">
            Mattermost 알림 활성화
          </label>
        </div>

        {formData.is_enabled && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Server URL</label>
              <Input
                type="url"
                value={formData.server_url}
                onChange={(e) => setFormData({ ...formData, server_url: e.target.value })}
                placeholder="https://your-mattermost-instance.com"
                className="mt-2"
                required
              />
              <p className="mt-1 text-xs text-custom-text-400">
                Mattermost 서버 URL을 입력하세요 (예: https://mattermost.example.com)
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">봇 토큰</label>
              <Input
                type="password"
                value={formData.bot_token}
                onChange={(e) => setFormData({ ...formData, bot_token: e.target.value })}
                placeholder="Mattermost 봇 계정의 액세스 토큰"
                className="mt-2"
                required
              />
              <p className="mt-1 text-xs text-custom-text-400">
                Mattermost에서 생성한 봇 계정의 액세스 토큰을 입력하세요. 개별 사용자에게 DM으로 알림을 보내는데
                사용됩니다.
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button type="submit" variant="primary" loading={isLoading}>
            {isLoading ? "저장 중..." : "설정 저장"}
          </Button>
        </div>
      </form>
    </div>
  );
});
