import { useContext } from "react";
// mobx store
import { StoreContext } from "@/lib/store-context";
// constants
import { MAX_FILE_SIZE } from "@/constants/common";

export interface ValidationResult {
  isValid: boolean;
  error: string | null;
}

export const useFileValidation = () => {
  const context = useContext(StoreContext);
  if (context === undefined) throw new Error("useFileValidation must be used within StoreProvider");

  const { instance } = context;
  const { fileSettings } = instance;

  const validateFile = (file: File): ValidationResult => {
    // 서버 설정이 있으면 그것을 사용, 없으면 기본값 사용
    const maxFileSize = fileSettings?.max_file_size ?? MAX_FILE_SIZE;
    const allowedExtensions = fileSettings?.allowed_extensions ?? ["jpg", "jpeg", "png", "gif", "pdf"];

    // 파일 크기 검사
    if (file.size > maxFileSize) {
      const maxSizeMB = Math.floor(maxFileSize / (1024 * 1024));
      return { 
        isValid: false, 
        error: `파일 크기는 ${maxSizeMB}MB를 초과할 수 없습니다.` 
      };
    }

    // 확장자 검사
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !allowedExtensions.includes(extension)) {
      return { 
        isValid: false, 
        error: `허용되지 않는 파일 형식입니다. 허용된 형식: ${allowedExtensions.join(', ')}` 
      };
    }

    return { 
      isValid: true,
      error: null 
    };
  };

  const getAcceptedFileTypes = (): Record<string, string[]> => {
    // 모든 파일 타입 허용
    return {
      '*/*': ['.*']  // 모든 파일 확장자 허용
    };
  };

  const getMaxFileSize = (): number => {
    return fileSettings?.max_file_size ?? MAX_FILE_SIZE;
  };

  return {
    validateFile,
    getAcceptedFileTypes,
    getMaxFileSize,
    isLoaded: !!fileSettings,
    settings: fileSettings  // settings 기본값 제거하고 fileSettings 그대로 반환
  } as const;
}; 