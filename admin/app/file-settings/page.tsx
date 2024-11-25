"use client";

import { observer } from "mobx-react";
import { useFileSettings } from "@/hooks/store";
import { FileSettingsForm } from "./form";

function FileSettingsPage() {
  const { settings, updateSettings, isLoading } = useFileSettings();

  return (
    <div className="relative container mx-auto w-full h-full p-4 py-4 space-y-6 flex flex-col">
      <div className="border-b border-custom-border-100 mx-4 py-4 space-y-1 flex-shrink-0">
        <div className="text-xl font-medium text-custom-text-100">File Upload Settings</div>
        <div className="text-sm font-normal text-custom-text-300">
          Configure file upload settings. Control file size limits and allowed file types.
        </div>
      </div>
      <div className="flex-grow overflow-hidden overflow-y-scroll vertical-scrollbar scrollbar-md px-4">
        {isLoading ? (
          <div>Loading...</div>
        ) : (
          <FileSettingsForm
            settings={settings}
            onSubmit={updateSettings}
          />
        )}
      </div>
    </div>
  );
}

export default observer(FileSettingsPage);