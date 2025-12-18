import { useEffect, useState } from "react";
import axios from "axios";
import { observer } from "mobx-react";
import { useRouter, usePathname } from "next/navigation";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { useFileSettings, useInstance } from "@/hooks/store";
import { useAuth, useUser } from "@/hooks/store/use-user";
import { FileSettingsForm } from "./form";

interface IFileSettings {
  allowed_extensions: string[];
  max_file_size: number;
}

interface ApiError {
  response?: {
    status: number;
  };
}

function FileSettingsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { isAdmin, isLoading: authLoading } = useAuth();
  const { currentUser } = useUser();
  const { fetchInstanceInfo } = useInstance();
  const { settings, fetchSettings, updateSettings, isLoading } = useFileSettings();
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // 경로에서 '/god-mode' 접두사를 제거하는 함수
  const getNormalizedPath = (path: string) => path.replace(/^\/god-mode/, "");

  // 인증 오류 처리 함수
  const handleAuthError = () => {
    console.log("File-settings 페이지: 인증 오류 발생, 리다이렉션 실행");
    const normalizedPath = getNormalizedPath(pathname);
    window.location.replace(`/god-mode/?next_path=${normalizedPath}`);
  };

  // 직접 인스턴스 관리자 API 호출로 인증 체크
  useEffect(() => {
    // 페이지 로드 즉시 직접 API 호출하여 401 에러 발생시키기
    console.log("File-settings 페이지: 직접 API 호출로 인증 체크");
    axios
      .get("/api/instances/admins/", { withCredentials: true })
      .then((response) => {
        console.log("File-settings 페이지: 관리자 API 호출 성공", response.data);
      })
      .catch((error) => {
        console.log("File-settings 페이지: 관리자 API 호출 오류", error);
        // 401 에러 발생 시 리다이렉션
        if (error.response && error.response.status === 401) {
          const currentPath = window.location.pathname;
          const normalizedPath = currentPath.replace(/^\/god-mode/, "");
          window.location.replace(`/god-mode/?next_path=${normalizedPath}`);
        }
      });
  }, []);

  // 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      try {
        console.log("File-settings 페이지: 데이터 로딩 시작");
        await fetchSettings();
        console.log("File-settings 페이지: 설정 데이터 로드 완료", settings);
        console.log("File-settings 페이지: currentUser", currentUser);
        setIsDataLoaded(true);
      } catch (error) {
        console.error("File-settings 페이지: 데이터 로드 오류", error);
      }
    };

    if (!authLoading && isAdmin && !isDataLoaded) {
      loadData();
    }
  }, [authLoading, isAdmin, settings, currentUser, fetchSettings, isDataLoaded]);

  const handleSubmit = async (data: Partial<IFileSettings>): Promise<IFileSettings> => {
    try {
      const result = await updateSettings(data);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "설정 저장 완료",
        message: "설정이 성공적으로 저장되었습니다.",
      });
      return result;
    } catch (error) {
      console.error("Error updating settings:", error);

      // 인증 오류(401) 확인하기
      const apiError = error as ApiError;
      if (apiError?.response?.status === 401) {
        handleAuthError();
        throw error;
      }

      setToast({
        type: TOAST_TYPE.ERROR,
        title: "설정 저장 실패",
        message: "설정 저장에 실패했습니다.",
      });
      throw error;
    }
  };

  // 로딩 중일 경우 아무것도 표시하지 않음
  if (authLoading || !isDataLoaded) {
    console.log("File-settings 페이지: 로딩 중", { authLoading, isDataLoaded });
    return null;
  }

  return (
    <div className="relative container mx-auto w-full h-full p-4 py-4 space-y-6 flex flex-col">
      <div className="border-b border-custom-border-100 mx-4 py-4 space-y-1 flex-shrink-0">
        <div className="text-xl font-medium text-custom-text-100">파일 업로드 설정</div>
        <div className="text-sm font-normal text-custom-text-300">
          파일 업로드 설정을 관리합니다. 파일 크기 제한과 허용된 파일 형식을 설정할 수 있습니다.
        </div>
      </div>
      <div className="flex-grow overflow-hidden overflow-y-scroll vertical-scrollbar scrollbar-md px-4">
        {isLoading ? <div>로딩 중...</div> : <FileSettingsForm settings={settings} onSubmit={handleSubmit} />}
      </div>
    </div>
  );
}

export default observer(FileSettingsPage);
