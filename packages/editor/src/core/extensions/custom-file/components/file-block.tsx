import React, { useState, useEffect } from "react";
import { FileIcon, Download, Trash2 } from "lucide-react";
import { cn } from "@plane/utils";
import { formatBytes } from "../../../helpers/file";
import type { CustomBaseFileNodeViewProps } from "../custom-file";
import { getFileIconByExtension } from "../../../helpers/file-icon";

interface FileBlockProps extends CustomBaseFileNodeViewProps {
  editorContainer: HTMLDivElement | null;
  onDelete: () => Promise<void>;
  onDownload: () => Promise<void>;
  setFailedToLoadFile: (failed: boolean) => void;
}

export const FileBlock = (props: FileBlockProps) => {
  const { node, editor, editorContainer, onDelete, onDownload } = props;
  const { fileName, fileSize, fileType } = node.attrs;

  const extension = fileName?.split(".").pop()?.toLowerCase() || "";
  const FileTypeIcon = getFileIconByExtension(extension);
  const formattedSize = fileSize
    ? fileSize >= 1024 * 1024
      ? `${(fileSize / (1024 * 1024)).toFixed(1)}MB`
      : `${Math.round(fileSize / 1024)}KB`
    : "";

  return (
    <div className="flex items-center gap-3 p-3 border rounded-md bg-custom-background-100 hover:bg-custom-background-90">
      <div className="flex items-center justify-center w-12 h-12 bg-custom-background-80 rounded-md flex-shrink-0">
        <FileTypeIcon className="w-6 h-6 text-custom-text-200" />
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="font-medium text-sm text-custom-text-100 truncate">{fileName}</div>
        <div className="text-xs text-custom-text-200">
          {extension.toUpperCase()} • {formattedSize}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onDownload}
          className="p-1.5 text-custom-text-200 hover:text-custom-text-100 hover:bg-custom-background-80 rounded-md transition-colors"
          title="Download file"
        >
          <Download className="w-4 h-4" />
        </button>
        {editor.isEditable && (
          <button
            onClick={onDelete}
            className="p-1.5 text-custom-text-200 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
            title="Delete file"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
