// local imports
import { getFileURL } from "../file";

type TEditorSrcArgs = {
  assetId: string;
  projectId?: string;
  workspaceSlug: string;
};

/**
 * @description generate the file source using assetId
 * @param {TEditorSrcArgs} args
 */
export const getEditorAssetSrc = (args: TEditorSrcArgs): string | undefined => {
  const { assetId, projectId, workspaceSlug } = args;
  let url: string | undefined = "";
  if (projectId) {
    url = getFileURL(`/api/assets/v2/workspaces/${workspaceSlug}/projects/${projectId}/${assetId}/`);
  } else {
    url = getFileURL(`/api/assets/v2/workspaces/${workspaceSlug}/${assetId}/`);
  }
  return url;
};

/**
 * @description generate the file source using assetId
 * @param {TEditorSrcArgs} args
 */
export const getEditorAssetDownloadSrc = (args: TEditorSrcArgs): string | undefined => {
  const { assetId, projectId, workspaceSlug } = args;
  let url: string | undefined = "";
  if (projectId) {
    url = getFileURL(`/api/assets/v2/workspaces/${workspaceSlug}/projects/${projectId}/download/${assetId}/`);
  } else {
    url = getFileURL(`/api/assets/v2/workspaces/${workspaceSlug}/download/${assetId}/`);
  }
  return url;
};

export const getTextContent = (jsx: React.ReactNode | null | undefined): string => {
  if (!jsx) return "";

  const div = document.createElement("div");
  div.innerHTML = jsx.toString();
  return div.textContent?.trim() ?? "";
};

export const isEditorEmpty = (description: string | undefined): boolean =>
  !description ||
  description === "<p></p>" ||
  description === `<p class="editor-paragraph-block"></p>` ||
  description.trim() === "";

/**
 * 에디터가 현재 포커스되어 있는지 확인하는 함수
 * @returns {boolean} 에디터가 포커스되어 있으면 true
 */
export const isEditorFocused = (): boolean => {
  const activeElement = document.activeElement as HTMLElement;

  // 직접적인 에디터 클래스 확인
  if (activeElement?.classList.contains("tiptap") || activeElement?.classList.contains("ProseMirror")) {
    return true;
  }

  // 부모 요소 중에 에디터가 있는지 확인
  if (activeElement?.closest(".tiptap") || activeElement?.closest(".ProseMirror")) {
    return true;
  }

  // 제목 입력 필드 확인
  if (activeElement?.id === "title-input") {
    return true;
  }

  // 포커스된 에디터 컨테이너 확인
  if (document.querySelector(".tiptap:focus-within") || document.querySelector(".ProseMirror:focus-within")) {
    return true;
  }

  // 에디터 컨테이너 내부의 포커스 확인
  if (document.querySelector(".editor-container:focus-within")) {
    return true;
  }

  return false;
};
export enum CORE_EXTENSIONS {
  BLOCKQUOTE = "blockquote",
  BOLD = "bold",
  BULLET_LIST = "bulletList",
  CALLOUT = "calloutComponent",
  CHARACTER_COUNT = "characterCount",
  CODE_BLOCK = "codeBlock",
  CODE_INLINE = "code",
  CUSTOM_COLOR = "customColor",
  CUSTOM_FILE = "file-component",
  CUSTOM_IMAGE = "imageComponent",
  CUSTOM_LINK = "link",
  DOCUMENT = "doc",
  DROP_CURSOR = "dropCursor",
  ENTER_KEY = "enterKey",
  GAP_CURSOR = "gapCursor",
  HARD_BREAK = "hardBreak",
  HEADING = "heading",
  HEADINGS_LIST = "headingsList",
  HISTORY = "history",
  HORIZONTAL_RULE = "horizontalRule",
  IMAGE = "image",
  ITALIC = "italic",
  LIST_ITEM = "listItem",
  MARKDOWN_CLIPBOARD = "markdownClipboard",
  MENTION = "mention",
  ORDERED_LIST = "orderedList",
  PARAGRAPH = "paragraph",
  PLACEHOLDER = "placeholder",
  SIDE_MENU = "editorSideMenu",
  SLASH_COMMANDS = "slash-command",
  STRIKETHROUGH = "strike",
  TABLE = "table",
  TABLE_CELL = "tableCell",
  TABLE_HEADER = "tableHeader",
  TABLE_ROW = "tableRow",
  TASK_ITEM = "taskItem",
  TASK_LIST = "taskList",
  TEXT_ALIGN = "textAlign",
  TEXT_STYLE = "textStyle",
  TYPOGRAPHY = "typography",
  UNDERLINE = "underline",
  UTILITY = "utility",
  WORK_ITEM_EMBED = "issue-embed-component",
  EMOJI = "emoji",
}

export enum ADDITIONAL_EXTENSIONS {}
