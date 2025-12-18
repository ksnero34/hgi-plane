import { useCallback, useState } from "react";
import { InstanceService } from "@plane/services";
import type { IFileSettings } from "@plane/types";
import { API_BASE_URL } from "@plane/constants";

export const useFileSettings = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<IFileSettings | undefined>(undefined);
  const instanceService = new InstanceService();

  const fetchSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await instanceService.getFileSettings();
      setSettings(result);
      return result;
    } catch (error) {
      console.error("Error fetching file settings:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [instanceService]);

  const updateSettings = useCallback(
    async (data: Partial<IFileSettings>) => {
      try {
        setIsLoading(true);
        const updatedSettings = await instanceService.updateFileSettings(data);
        setSettings(updatedSettings);
        return updatedSettings;
      } catch (error) {
        console.error("Error updating file settings:", error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [instanceService]
  );

  return {
    settings,
    isLoading,
    fetchSettings,
    updateSettings,
  };
};
