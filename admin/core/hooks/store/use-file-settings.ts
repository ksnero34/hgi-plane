import { useCallback } from "react";
import { useInstance } from "./use-instance";
import { IFileSettings } from "@plane/types";

export const useFileSettings = () => {
  const instanceStore = useInstance();

  const fetchSettings = useCallback(async () => {
    try {
      return await instanceStore.fetchFileSettings();
    } catch (error) {
      console.error("Error fetching file settings:", error);
      throw error;
    }
  }, [instanceStore]);

  const updateSettings = useCallback(async (data: Partial<IFileSettings>) => {
    try {
      const updatedSettings = await instanceStore.updateFileSettings(data);
      return updatedSettings;
    } catch (error) {
      console.error("Error updating file settings:", error);
      throw error;
    }
  }, [instanceStore]);

  return {
    settings: instanceStore.fileSettings,
    isLoading: instanceStore.isLoading,
    fetchSettings,
    updateSettings,
  };
}; 