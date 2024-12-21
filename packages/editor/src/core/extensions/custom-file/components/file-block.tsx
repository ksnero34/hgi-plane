import React, { useState, useEffect } from "react";
import { FileIcon, Download, Trash2 } from "lucide-react";
import { cn } from "../../../helpers/common";
import { formatBytes } from "../../../helpers/file";
import { CustomBaseFileNodeViewProps } from "../custom-file";

interface FileBlockProps extends CustomBaseFileNodeViewProps {
  editorContainer: HTMLDivElement | null;
  onDelete: () => Promise<void>;
  onDownload: () => Promise<void>;
  setFailedToLoadFile: (failed: boolean) => void;
}

export const FileBlock = (props: FileBlockProps) => {
  const { node, editorContainer, onDelete, onDownload } = props;
  const { fileName, fileSize, fileType } = node.attrs;

  return (
    <div className="flex items-center gap-2 p-2 border rounded">
      <div className="flex-1">
        <div className="font-medium">{fileName}</div>
        <div className="text-sm text-gray-500">
          {fileSize ? `${Math.round(fileSize / 1024)}KB` : ""} {fileType}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onDownload}
          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
        >
          Download
        </button>
        <button
          onClick={onDelete}
          className="p-1 text-red-600 hover:bg-red-50 rounded"
        >
          Delete
        </button>
      </div>
    </div>
  );
}; 