import { Editor } from "@tiptap/core";
import { Trash2 } from "lucide-react";
// types
import { TFileHandler } from "@/types";
import { FileAttachmentAttributes } from "../file-node";

type Props = {
  editor: Editor;
  fileHandler: TFileHandler;
  node: {
    attrs: FileAttachmentAttributes;
  };
  editorContainer: HTMLDivElement | null;
};

export const FileToolbar = ({ editor, node }: Props) => {
  const handleDelete = () => {
    const { id } = node.attrs;
    const pos = editor.state.doc.resolve(0);
    const nodes = pos.doc.content;

    nodes.forEach((node, offset) => {
      if (node.attrs.id === id) {
        editor.commands.deleteRange({ from: offset, to: offset + 1 });
      }
    });
  };

  return (
    <div className="absolute right-2 top-2 hidden group-hover:flex items-center gap-2 bg-custom-background-100 rounded p-1">
      <button
        type="button"
        onClick={handleDelete}
        className="grid place-items-center hover:bg-custom-background-80 p-1 rounded"
      >
        <Trash2 className="size-3.5 text-custom-text-400" />
      </button>
    </div>
  );
}; 