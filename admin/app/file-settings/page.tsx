"use client";

import { useEffect } from "react";
import { observer } from "mobx-react";
import { useRouter, usePathname } from "next/navigation";
import { TOAST_TYPE, setToast, Loader } from "@plane/ui";
import { useFileSettings } from "@/hooks/store";
import { useAuth } from "@/hooks/store/use-user";
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
  const { settings, fetchSettings, updateSettings, isLoading } = useFileSettings();

  // 경로에서 '/god-mode' 접두사를 제거하는 함수
  const getNormalizedPath = (path: string) => path.replace(/^\/god-mode/, '');

  // 인증 오류 처리 함수
  const handleAuthError = () => {
    console.log("인증 오류가 발생했습니다. 로그인 페이지로 리다이렉션합니다.");
    const normalizedPath = getNormalizedPath(pathname);
    window.location.replace(`/god-mode/?next_path=${normalizedPath}`);
  };

  // 권한 체크
  useEffect(() => {
    if (!authLoading && isAdmin) {
      // 관리자일 때만 데이터를 가져옴
      fetchSettings().catch((error) => {
        // checkAndLogError(error, "파일 설정 불러오기");
      });
    }
  }, [authLoading, isAdmin]);

  const handleSubmit = async (data: Partial<IFileSettings>): Promise<IFileSettings> => {
    try {
      const result = await updateSettings(data);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "설정 저장 완료",
        message: "설정이 성공적으로 저장되었습니다."
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
        message: "설정 저장에 실패했습니다."
      });
      throw error;
    }
  };

  // 로딩 중이거나 관리자가 아닌 경우 아무것도 표시하지 않음
  if (authLoading || !isAdmin) {
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
        {isLoading ? (
          <div>로딩 중...</div>
        ) : (
          <FileSettingsForm
            settings={settings}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </div>
  );
}

export default observer(FileSettingsPage);