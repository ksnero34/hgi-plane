// local imports
import { getFileURL } from "./file";

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

export const getTextContent = (jsx: React.ReactNode | React.ReactNode | null | undefined): string => {
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
