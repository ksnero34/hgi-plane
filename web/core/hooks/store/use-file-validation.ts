import { useContext } from "react";
// mobx store
import { StoreContext } from "@/lib/store-context";

interface ValidationResult {
  isValid: boolean;
  error: string | null;
}

export const useFileValidation = () => {
  const context = useContext(StoreContext);
  if (context === undefined) throw new Error("useFileValidation must be used within StoreProvider");

  const { instance } = context;
  const { fileSettings } = instance;

  const validateFile = (file: File): ValidationResult => {
    if (!fileSettings) {
      return { 
        isValid: false, 
        error: "파일 설정을 불러올 수 없습니다." 
      };
    }

    // 파일 크기 검사
    if (file.size > fileSettings.max_file_size) {
      const maxSizeMB = Math.floor(fileSettings.max_file_size / (1024 * 1024));
      return { 
        isValid: false, 
        error: `파일 크기는 ${maxSizeMB}MB를 초과할 수 없습니다.` 
      };
    }

    // 확장자 검사
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !fileSettings.allowed_extensions.includes(extension)) {
      return { 
        isValid: false, 
        error: `허용되지 않는 파일 형식입니다. 허용된 형식: ${fileSettings.allowed_extensions.join(', ')}` 
      };
    }

    return { 
      isValid: true,
      error: null 
    };
  };

  const getAcceptedFileTypes = (): Record<string, string[]> => {
    if (!fileSettings?.allowed_extensions) return {};
    
    // MIME 타입으로 변환
    const acceptedTypes: Record<string, string[]> = {};
    fileSettings.allowed_extensions.forEach(ext => {
      switch(ext.toLowerCase()) {
        case 'jpg':
        case 'jpeg':
          acceptedTypes['image/jpeg'] = [`.${ext}`];
          break;
        case 'png':
          acceptedTypes['image/png'] = [`.${ext}`];
          break;
        case 'gif':
          acceptedTypes['image/gif'] = [`.${ext}`];
          break;
        case 'pdf':
          acceptedTypes['application/pdf'] = [`.${ext}`];
          break;
        case 'doc':
        case 'docx':
          acceptedTypes['application/msword'] = [`.${ext}`];
          acceptedTypes['application/vnd.openxmlformats-officedocument.wordprocessingml.document'] = [`.${ext}`];
          break;
        default:
          // 기타 파일 타입의 경우
          acceptedTypes[`application/${ext}`] = [`.${ext}`];
      }
    });
    
    return acceptedTypes;
  };

  const getMaxFileSize = (): number => {
    return fileSettings?.max_file_size ?? 5 * 1024 * 1024; // 기본값 5MB
  };

  return {
    validateFile,
    getAcceptedFileTypes,
    getMaxFileSize,
  } as const;
}; 