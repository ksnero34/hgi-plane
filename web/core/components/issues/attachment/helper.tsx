import { TOAST_TYPE, setToast } from "@plane/ui";
import { ValidationResult } from "@/hooks/store/use-file-validation";

export const validateFileBeforeUpload = (file: File, validateFile: (file: File) => ValidationResult): boolean => {
  const { isValid, error } = validateFile(file);
  
  if (!isValid) {
    setToast({
      type: TOAST_TYPE.ERROR,
      title: "파일 검증 실패",
      message: error || "유효하지 않은 파일입니다"
    });
    return false;
  }
  
  return true;
};

export const handleUploadError = (error: any) => {
  console.log("🔍 Upload Error Details:", {
    error: error,
    response: error.response,
    data: error.response?.data,
    status: error.response?.status,
    statusText: error.response?.statusText,
    message: error.message,
  });

  if (error.error) {
    console.log("📝 Server Error Message:", error.error);
    setToast({
      type: TOAST_TYPE.ERROR,
      title: "파일 업로드 실패",
      message: error.error
    });
  } else {
    console.log("❌ No specific error message from server");
    setToast({
      type: TOAST_TYPE.ERROR,
      title: "파일 업로드 실패",
      message: "파일을 업로드하는 중 오류가 발생했습니다."
    });
  }
}; 