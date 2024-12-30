"use client";

import { useEffect } from "react";
import { observer } from "mobx-react";
import { TOAST_TYPE, setToast } from "@plane/ui";
import { useFileSettings } from "@/hooks/store";
import { FileSettingsForm } from "./form";

interface IFileSettings {
  allowed_extensions: string[];
  max_file_size: number;
}

function FileSettingsPage() {
  const { settings, fetchSettings, updateSettings, isLoading } = useFileSettings();

  useEffect(() => {
    fetchSettings().catch((error) => {
      console.error("Error fetching file settings:", error);
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "설정 불러오기 실패",
        message: "설정을 불러오는데 실패했습니다."
      });
    });
  }, [fetchSettings]);

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
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "설정 저장 실패",
        message: "설정 저장에 실패했습니다."
      });
      throw error;
    }
  };

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