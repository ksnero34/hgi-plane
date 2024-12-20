import { NodeViewWrapper } from "@tiptap/react";
import { CustomBaseFileNodeViewProps } from "../custom-file";
import { FileBlock } from "./file-block";
import { FileUploader } from "./file-uploader";

export const FileNode = (props: CustomBaseFileNodeViewProps) => {
  const { uploadStatus } = props;

  return (
    <NodeViewWrapper>
      {uploadStatus === "uploading" ? (
        <FileUploader {...props} />
      ) : (
        <FileBlock {...props} />
      )}
    </NodeViewWrapper>
  );
}; 