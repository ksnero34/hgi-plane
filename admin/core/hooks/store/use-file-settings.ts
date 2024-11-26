import { useCallback, useState } from "react";
import { useInstance } from "./use-instance";
import { IFileSettings } from "@plane/types";

export const useFileSettings = () => {
  const instanceStore = useInstance();
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await instanceStore.fetchFileSettings();
      return result;
    } catch (error) {
      console.error("Error fetching file settings:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [instanceStore]);

  const updateSettings = useCallback(async (data: Partial<IFileSettings>) => {
    try {
      setIsLoading(true);
      const updatedSettings = await instanceStore.updateFileSettings(data);
      return updatedSettings;
    } catch (error) {
      console.error("Error updating file settings:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [instanceStore]);

  return {
    settings: instanceStore.fileSettings,
    isLoading,
    fetchSettings,
    updateSettings,
  };
}; 