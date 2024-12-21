import { useEffect, useRef } from "react";
import { CustomBaseFileNodeViewProps } from "../custom-file";

interface FileUploaderProps extends CustomBaseFileNodeViewProps {
  setIsUploaded: (uploaded: boolean) => void;
  setFailedToLoadFile: (failed: boolean) => void;
}

export const FileUploader = (props: FileUploaderProps) => {
  const { editor, node, updateAttributes, setIsUploaded, setFailedToLoadFile } = props;
  const { id: fileId } = node.attrs;
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fileMap = editor.storage.customFile.fileMap;
    const fileEntity = fileMap.get(fileId);

    if (!fileEntity) {
      setFailedToLoadFile(true);
      return;
    }

    const uploadFile = async (file: File) => {
      try {
        const url = await editor.commands.uploadFile(file);
        if (!url) throw new Error("Failed to upload file");

        updateAttributes({
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          uploadStatus: "success",
        });
        setIsUploaded(true);
      } catch (error) {
        console.error("Error uploading file:", error);
        updateAttributes({ uploadStatus: "error" });
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
      const url = await editor.commands.uploadFile(file);
      if (!url) throw new Error("Failed to upload file");

      updateAttributes({
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        uploadStatus: "success",
      });
      setIsUploaded(true);
    } catch (error) {
      console.error("Error uploading file:", error);
      updateAttributes({ uploadStatus: "error" });
      setFailedToLoadFile(true);
    }
  };

  return (
    <div className="flex items-center justify-center p-4 border-2 border-dashed rounded">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />
      <div className="text-center">
        <p className="text-sm text-gray-500">
          {node.attrs.uploadStatus === "error" ? (
            "Failed to upload file. Click to try again."
          ) : (
            "Click to select a file"
          )}
        </p>
      </div>
    </div>
  );
}; 