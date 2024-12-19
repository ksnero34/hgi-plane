import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileIcon, FileText, FileImage, FileVideo, FileAudio, FileArchive, FileCode } from "lucide-react";
// helpers
import { cn } from "@/helpers/common";
import { formatBytes } from "@/helpers/file.helper";
// types
import { FileAttachmentAttributes } from "./file-node";
import { CustoBaseImageNodeViewProps } from "../custom-image";

type FileBlockProps = CustoBaseImageNodeViewProps & {
  fileFromFileSystem?: string;
  setFailedToLoad: (failed: boolean) => void;
};

const getFileIcon = (fileType: string | null, fileExtension: string | null) => {
  if (!fileType && !fileExtension) return FileIcon;

  const type = fileType?.split('/')?.[0] || '';
  const ext = fileExtension?.toLowerCase() || '';

  switch (type) {
    case 'image':
      return FileImage;
    case 'video':
      return FileVideo;
    case 'audio':
      return FileAudio;
    case 'text':
      return FileText;
    default:
      // 확장자 기반 아이콘
      switch (ext) {
        case 'pdf':
          return FileText;
        case 'doc':
        case 'docx':
        case 'txt':
        case 'rtf':
          return FileText;
        case 'zip':
        case 'rar':
        case '7z':
        case 'tar':
        case 'gz':
          return FileArchive;
        case 'js':
        case 'jsx':
        case 'ts':
        case 'tsx':
        case 'html':
        case 'css':
        case 'py':
        case 'java':
        case 'cpp':
        case 'c':
        case 'php':
          return FileCode;
        default:
          return FileIcon;
      }
  }
};

export const FileBlock = (props: FileBlockProps) => {
  const { editor, node, selected, fileFromFileSystem, setFailedToLoad } = props;
  const { src: fileSrc, fileName, fileSize, fileType, fileExtension } = node.attrs as FileAttachmentAttributes;

  const [isLoading, setIsLoading] = useState(true);
  const [hasErrored, setHasErrored] = useState(false);
  const hasTriedRestoringOnce = useRef(false);

  useEffect(() => {
    if (fileSrc) {
      setIsLoading(false);
    }
  }, [fileSrc]);

  const handleError = useCallback(async () => {
    if (!editor?.commands.restoreFile || hasTriedRestoringOnce.current) {
      setFailedToLoad(true);
      return;
    }

    try {
      await editor?.commands.restoreFile?.(fileSrc);
    } catch {
      setHasErrored(true);
      console.error("파일 복원 실패");
    } finally {
      hasTriedRestoringOnce.current = true;
    }
  }, [editor, fileSrc, setFailedToLoad]);

  if (isLoading || !fileSrc) {
    return (
      <div className="animate-pulse bg-custom-background-80 rounded-md p-4">
        <div className="flex items-center gap-3">
          <div className="size-10 bg-custom-background-90 rounded" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-custom-background-90 rounded w-1/4" />
            <div className="h-3 bg-custom-background-90 rounded w-1/6" />
          </div>
        </div>
      </div>
    );
  }

  if (hasErrored) {
    return (
      <div className="bg-red-50 text-red-500 rounded-md p-4">
        <p>파일을 불러오는데 실패했습니다.</p>
      </div>
    );
  }

  const FileTypeIcon = getFileIcon(fileType, fileExtension);

  return (
    <div 
      className={cn("my-2 flex items-center gap-2 rounded-md border p-3.5 relative group/file-component", {
        "border-custom-primary-100": selected,
        "border-custom-border-200": !selected,
      })}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded bg-custom-background-80">
        <FileTypeIcon className="size-5 text-custom-text-200" />
      </div>
      <div className="flex-grow min-w-0">
        <h6 className="text-sm font-medium text-custom-text-100 truncate">
          {fileName || "Untitled"}
        </h6>
        <p className="text-xs text-custom-text-200">
          {fileSize ? formatBytes(fileSize) : "Unknown size"}
        </p>
      </div>
      {fileSrc && (
        <a
          href={fileSrc}
          download={fileName}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-custom-background-80"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <Download className="h-4 w-4 text-custom-text-200" />
        </a>
      )}
      {selected && (
        <div className="absolute inset-0 rounded-md bg-custom-primary-100/10 pointer-events-none" />
      )}
    </div>
  );
}; 