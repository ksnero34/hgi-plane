import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { ValidationResult } from "@/hooks/store/use-file-validation";

export const validateFileBeforeUpload = async (
  file: File,
  validateFile: (file: File) => Promise<ValidationResult>
): Promise<boolean> => {
  try {
    const validationResult = await validateFile(file);
    if (!validationResult.isValid) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Invalid file",
        message: validationResult.error || "Invalid file",
      });
      return false;
    }
    return true;
  } catch (error) {
    console.error("File validation error:", error);
    setToast({
      type: TOAST_TYPE.ERROR,
      title: "Validation error",
      message: "Failed to validate file",
    });
    return false;
  }
};

export const handleUploadError = (error: any) => {
  // console.log("🔍 Upload Error Details:", {
  //   error: error,
  //   response: error.response,
  //   data: error.response?.data,
  //   status: error.response?.status,
  //   statusText: error.response?.statusText,
  //   message: error.message,
  // });

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