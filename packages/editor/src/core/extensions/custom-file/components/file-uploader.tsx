import React, { useCallback, useEffect, useRef } from "react";
import { FileIcon, X } from "lucide-react";
import { cn } from "../../../helpers/common";
import { CustomBaseFileNodeViewProps, getFileComponentFileMap } from "../custom-file";

export const FileUploader = (props: CustomBaseFileNodeViewProps) => {
  const { editor, fileId } = props;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fileMap = getFileComponentFileMap(editor);
  const fileEntity = fileMap?.get(fileId);

  const handleFileChange = useCallback(
    async (file: File) => {
      try {
        // @ts-expect-error function not expected here
        const url = await editor?.commands?.uploadFile?.(file);
        if (!url) throw new Error("Failed to upload file");

        props.updateAttributes({
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          uploadStatus: "success",
        });
      } catch (error) {
        console.error("Error uploading file:", error);
        props.updateAttributes({
          uploadStatus: "error",
        });
      }
    },
    [editor, props]
  );

  useEffect(() => {
    if (!fileEntity) return;

    if (fileEntity.event === "drop" && fileEntity.file) {
      handleFileChange(fileEntity.file);
    } else if (fileEntity.event === "insert" && !fileEntity.hasOpenedFileInputOnce) {
      fileInputRef.current?.click();
      if (fileMap) {
        fileMap.set(fileId, {
          ...fileEntity,
          hasOpenedFileInputOnce: true,
        });
      }
    }
  }, [fileEntity, fileId, fileMap, handleFileChange]);

  return (
    <div className="relative">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileChange(file);
        }}
      />
      <div className="flex items-center gap-2 p-3 rounded-md border border-custom-border-200">
        <div className="flex items-center justify-center w-10 h-10 bg-custom-background-80 rounded">
          <FileIcon className="w-5 h-5 text-custom-text-200" />
        </div>
        <div className="flex-grow">
          <div className="h-2 w-24 bg-custom-background-80 rounded animate-pulse" />
          <div className="h-2 w-16 bg-custom-background-80 rounded animate-pulse mt-2" />
        </div>
      </div>
    </div>
  );
}; 