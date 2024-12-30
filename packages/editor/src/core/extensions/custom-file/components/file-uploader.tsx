import { useEffect, useRef, useState } from "react";
import { CustomBaseFileNodeViewProps } from "../custom-file";
import { Upload, AlertCircle, Loader2 } from "lucide-react";

interface FileUploaderProps extends CustomBaseFileNodeViewProps {
  setIsUploaded: (uploaded: boolean) => void;
  setFailedToLoadFile: (failed: boolean) => void;
}

export const FileUploader = (props: FileUploaderProps) => {
  const { editor, node, updateAttributes, setIsUploaded, setFailedToLoadFile } = props;
  const { id: fileId } = node.attrs;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  useEffect(() => {
    const fileMap = editor.storage.customFile.fileMap;
    const fileEntity = fileMap.get(fileId);

    if (!fileEntity) {
      setFailedToLoadFile(true);
      return;
    }

    const uploadFile = async (file: File) => {
      setIsUploading(true);
      setUploadProgress(0);
      try {
        const fileHandler = editor.storage.customFile.fileHandler;
        if (fileHandler.validateFile) {
          const fileExtension = file.name.split('.').pop()?.toLowerCase();
          const allowedExtensions = fileHandler.validation.allowedExtensions;
          const maxFileSize = fileHandler.validation.maxFileSize;
          const maxFileSizeMB = Math.round(maxFileSize / (1024 * 1024));

          if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
            throw new Error(`허용되지 않는 파일 형식입니다. 허용된 확장자: ${allowedExtensions.join(', ')} , 선택한 파일 확장자: ${fileExtension}`);
          }

          if (file.size > maxFileSize) {
            throw new Error(`파일 크기가 너무 큽니다. 최대 파일 크기: ${maxFileSizeMB}MB`);
          }
        }

        // 업로드 진행 상태를 시뮬레이션
        const progressInterval = setInterval(() => {
          setUploadProgress(prev => {
            if (prev >= 90) {
              clearInterval(progressInterval);
              return prev;
            }
            return prev + 10;
          });
        }, 500);

        const response = await fileHandler.upload(file);
        clearInterval(progressInterval);
        setUploadProgress(100);

        if (!response) throw new Error("Failed to upload file");

        const assetId = response.split("/").filter(Boolean).pop()?.replace("/", "");
        if (!assetId) throw new Error("Failed to get asset ID");

        updateAttributes({
          id: assetId,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          uploadStatus: "success",
        });
        setIsUploaded(true);
        setErrorMessage("");
      } catch (error: any) {
        console.error("Error uploading file:", error);
        const message = error?.response?.data?.message || error?.message || "파일 업로드에 실패했습니다.";
        setErrorMessage(message);
        updateAttributes({ uploadStatus: "error", errorMessage: message });
        setFailedToLoadFile(true);
      } finally {
        setIsUploading(false);
      }
    };

    if (fileEntity.file) {
      uploadFile(fileEntity.file);
    } else if (fileEntity.event === "insert" && !fileEntity.hasOpenedFileInputOnce) {
      fileInputRef.current?.click();
      fileMap.set(fileId, { ...fileEntity, hasOpenedFileInputOnce: true });
    }
  }, [fileId]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);

    const fileMap = editor.storage.customFile.fileMap;
    fileMap.set(fileId, { event: "insert", file });

    try {
      const fileHandler = editor.storage.customFile.fileHandler;
      if (fileHandler.validateFile) {
        const fileExtension = file.name.split('.').pop()?.toLowerCase();
        const allowedExtensions = fileHandler.validation.allowedExtensions;
        const maxFileSize = fileHandler.validation.maxFileSize;
        const maxFileSizeMB = Math.round(maxFileSize / (1024 * 1024));

        if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
          throw new Error(`허용되지 않는 파일 형식입니다. 허용된 확장자: ${allowedExtensions.join(', ')}, 선택한 파일 확장자: ${fileExtension}`);
        }

        if (file.size > maxFileSize) {
          throw new Error(`파일 크기가 너무 큽니다. 최대 파일 크기: ${maxFileSizeMB}MB`);
        }
      }

      // 업로드 진행 상태를 시뮬레이션
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 500);

      const response = await fileHandler.upload(file);
      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response) throw new Error("Failed to upload file");

      const assetId = response.split("/").filter(Boolean).pop()?.replace("/", "");
      if (!assetId) throw new Error("Failed to get asset ID");

      updateAttributes({
        id: assetId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        uploadStatus: "success",
      });
      setIsUploaded(true);
      setErrorMessage("");
    } catch (error: any) {
      console.error("Error uploading file:", error);
      const message = error?.response?.data?.message || error?.message || "파일 업로드에 실패했습니다.";
      setErrorMessage(message);
      updateAttributes({ uploadStatus: "error", errorMessage: message });
      setFailedToLoadFile(true);
    } finally {
      setIsUploading(false);
    }
  };

  const isError = node.attrs.uploadStatus === "error";

  return (
    <div 
      className={`flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-md transition-colors cursor-pointer
        ${isError 
          ? "border-red-300 bg-red-50 hover:bg-red-100" 
          : "border-custom-border-200 hover:border-custom-border-400 hover:bg-custom-background-90"
        }`}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />
      <div className="flex flex-col items-center gap-2">
        {isError ? (
          <>
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-sm text-red-600 text-center">
              {node.attrs.errorMessage || errorMessage || "Failed to upload file. Click to try again."}
            </p>
          </>
        ) : isUploading ? (
          <>
            <Loader2 className="w-5 h-5 text-custom-text-200 animate-spin" />
            <p className="text-sm text-custom-text-200">
              파일 업로드 중... {uploadProgress}%
            </p>
            <div className="w-full h-1 bg-gray-200 rounded-full mt-2">
              <div 
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </>
        ) : (
          <>
            <Upload className="w-5 h-5 text-custom-text-200" />
            <p className="text-sm text-custom-text-200">
              Click to select a file
            </p>
          </>
        )}
      </div>
    </div>
  );
}; 