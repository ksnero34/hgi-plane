import { useEffect, useRef, useState } from "react";
import { CustomBaseFileNodeViewProps } from "../custom-file";
import { Upload, AlertCircle } from "lucide-react";

interface FileUploaderProps extends CustomBaseFileNodeViewProps {
  setIsUploaded: (uploaded: boolean) => void;
  setFailedToLoadFile: (failed: boolean) => void;
}

export const FileUploader = (props: FileUploaderProps) => {
  const { editor, node, updateAttributes, setIsUploaded, setFailedToLoadFile } = props;
  const { id: fileId } = node.attrs;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const fileMap = editor.storage.customFile.fileMap;
    const fileEntity = fileMap.get(fileId);

    if (!fileEntity) {
      setFailedToLoadFile(true);
      return;
    }

    const uploadFile = async (file: File) => {
      try {
        const fileHandler = editor.storage.customFile.fileHandler;
        if (fileHandler.validateFile) {
          const isValid = await fileHandler.validateFile(file);
          if (!isValid) {
            const allowedExtensions = fileHandler.validation.allowedExtensions;
            const maxFileSize = fileHandler.validation.maxFileSize;
            const maxFileSizeMB = Math.round(maxFileSize / (1024 * 1024));
            
            throw new Error(`허용되지 않는 파일 형식입니다. 허용된 확장자: ${allowedExtensions.join(', ')}\n최대 파일 크기: ${maxFileSizeMB}MB`);
          }
        }

        const response = await fileHandler.upload(file);
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

    const fileMap = editor.storage.customFile.fileMap;
    fileMap.set(fileId, { event: "insert", file });

    try {
      const fileHandler = editor.storage.customFile.fileHandler;
      if (fileHandler.validateFile) {
        const isValid = await fileHandler.validateFile(file);
        if (!isValid) {
          const allowedExtensions = fileHandler.validation.allowedExtensions;
          const maxFileSize = fileHandler.validation.maxFileSize;
          const maxFileSizeMB = Math.round(maxFileSize / (1024 * 1024));
          
          throw new Error(`허용되지 않는 파일 형식입니다. 허용된 확장자: ${allowedExtensions.join(', ')}\n최대 파일 크기: ${maxFileSizeMB}MB`);
        }
      }

      const response = await fileHandler.upload(file);
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
    }
  };

  const isError = node.attrs.uploadStatus === "error";

  return (
    <div 
      className={`flex items-center justify-center p-4 border-2 border-dashed rounded-md transition-colors cursor-pointer
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