import { NodeViewProps } from "@tiptap/core";
import { NodeViewWrapper } from "@tiptap/react";
import { Download } from "lucide-react";
import { formatBytes } from "../../helpers/file.helper";

export const FileAttachmentComponent: React.FC<NodeViewProps> = (props) => {
  const { node } = props;
  const { fileName, fileSize, fileUrl, fileExtension } = node.attrs;

  return (
    <NodeViewWrapper>
      <div className="my-2 flex items-center gap-2 rounded-md border border-custom-border-200 p-3.5">
        <div className="flex h-10 w-10 items-center justify-center rounded bg-custom-background-80">
          <span className="text-sm font-medium text-custom-text-200">
            {fileExtension?.toUpperCase() || "FILE"}
          </span>
        </div>
        <div className="flex-grow min-w-0">
          <h6 className="text-sm font-medium text-custom-text-100 truncate">
            {fileName}
          </h6>
          <p className="text-xs text-custom-text-200">
            {formatBytes(fileSize)}
          </p>
        </div>
        <a
          href={fileUrl}
          download={fileName}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-custom-background-80"
        >
          <Download className="h-4 w-4 text-custom-text-200" />
        </a>
      </div>
    </NodeViewWrapper>
  );
}; 