import { EditorProps } from "@tiptap/pm/view";
// plane utils
import { cn } from "@plane/utils";

export type TCoreEditorProps = {
  editorClassName: string;
};

export const CoreEditorProps = (props: TCoreEditorProps): EditorProps => {
  const { editorClassName } = props;

  return {
    attributes: {
      class: cn(
        "prose prose-brand max-w-full prose-headings:font-display font-default focus:outline-none",
        editorClassName
      ),
    },
    handleDOMEvents: {
      keydown: (_view, event) => {
        // prevent default event listeners from firing when slash command is active
        if (["ArrowUp", "ArrowDown", "Enter"].includes(event.key)) {
          const slashCommand = document.querySelector("#slash-command");
          if (slashCommand) {
            return true;
          }
        }
        
        // 에디터 내에서 화살표 키 사용 시 이벤트 전파 방지
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
          // 이벤트가 에디터 내부에서 발생했는지 확인
          const target = event.target as HTMLElement;
          if (target?.closest(".tiptap") || target?.closest(".ProseMirror")) {
            // 이벤트 전파를 중단하여 외부 리스너들이 반응하지 않도록 함
            event.stopPropagation();
          }
        }
      },
    },
    transformPastedHTML(html) {
      return html.replace(/<img.*?>/g, "");
    },
  };
};
