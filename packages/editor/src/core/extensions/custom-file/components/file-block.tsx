import React from "react";
import { FileIcon, Download, Trash2 } from "lucide-react";
import { cn } from "../../../helpers/common";
import { formatBytes } from "../../../helpers/file";
import { CustomBaseFileNodeViewProps } from "../custom-file";

export const FileBlock = ({
  fileId,
  fileName,
  fileSize,
  fileType,
  onDelete,
  onDownload,
}: CustomBaseFileNodeViewProps) => {
  return (
    <div className="flex items-center gap-2 p-3 rounded-md border border-custom-border-200">
      <div className="flex items-center justify-center w-10 h-10 bg-custom-background-80 rounded">
        <FileIcon className="w-5 h-5 text-custom-text-200" />
      </div>
      <div className="flex-grow min-w-0">
        <h6 className="text-sm font-medium truncate">{fileName}</h6>
        <p className="text-xs text-custom-text-200">
          {fileType} • {formatBytes(fileSize)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {onDownload && (
          <button
            type="button"
            onClick={onDownload}
            className="p-1.5 rounded hover:bg-custom-background-80"
          >
            <Download className="w-4 h-4 text-custom-text-200" />
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 rounded hover:bg-custom-background-80"
          >
            <Trash2 className="w-4 h-4 text-custom-text-200" />
          </button>
        )}
      </div>
    </div>
  );
}; 