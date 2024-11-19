// helpers
import {
  getAllDocumentFormatsFromBinaryData,
  getBinaryDataFromHTMLString,
} from "@/core/helpers/page.js";
// services
import { PageService } from "@/core/services/page.service.js";
import { manualLogger } from "../helpers/logger.js";
import { maskPersonalInfo } from '../helpers/masking.js';
const pageService = new PageService();

export const updatePageDescription = async (
  params: URLSearchParams,
  pageId: string,
  updatedDescription: Uint8Array,
  cookie: string | undefined,
) => {
  if (!(updatedDescription instanceof Uint8Array)) {
    throw new Error(
      "Invalid updatedDescription: must be an instance of Uint8Array",
    );
  }

  const workspaceSlug = params.get("workspaceSlug")?.toString();
  const projectId = params.get("projectId")?.toString();
  if (!workspaceSlug || !projectId || !cookie) return;

  const { contentBinaryEncoded, contentHTML, contentJSON } =
    getAllDocumentFormatsFromBinaryData(updatedDescription);
  try {
    const payload = {
      description_binary: contentBinaryEncoded,
      description_html: contentHTML,
      description: contentJSON,
    };

    await pageService.updateDescription(
      workspaceSlug,
      projectId,
      pageId,
      payload,
      cookie,
    );
  } catch (error) {
    manualLogger.error("Update error:", error);
    throw error;
  }
};

const fetchDescriptionHTMLAndTransform = async (
  workspaceSlug: string,
  projectId: string,
  pageId: string,
  cookie: string,
) => {
  if (!workspaceSlug || !projectId || !cookie) return;

  try {
    const pageDetails = await pageService.fetchDetails(
      workspaceSlug,
      projectId,
      pageId,
      cookie,
    );
    const { contentBinary } = getBinaryDataFromHTMLString(
      pageDetails.description_html ?? "<p></p>",
    );
    return contentBinary;
  } catch (error) {
    manualLogger.error(
      "Error while transforming from HTML to Uint8Array",
      error,
    );
    throw error;
  }
};

export const fetchPageDescriptionBinary = async (
  params: URLSearchParams,
  pageId: string,
  cookie: string | undefined,
) => {
  const workspaceSlug = params.get("workspaceSlug")?.toString();
  const projectId = params.get("projectId")?.toString();
  if (!workspaceSlug || !projectId || !cookie) return null;

  try {
    const response = await pageService.fetchDescriptionBinary(
      workspaceSlug,
      projectId,
      pageId,
      cookie,
    );

    // 빈 응답 체크
    if (!response || response.length === 0) {
      manualLogger.info("Empty response received, returning default empty document");
      return getBinaryDataFromHTMLString("<p></p>").contentBinary;
    }

    const binaryData = new Uint8Array(response);

    try {
      // 데이터를 문서 형식으로 변환 (마스킹 처리는 화면 표시용으로만)
      const { contentHTML } = getAllDocumentFormatsFromBinaryData(binaryData);
      
      manualLogger.info("WebSocket Document Load:");
      manualLogger.info("Original:", contentHTML);
      manualLogger.info("Masked (display only):", maskPersonalInfo(contentHTML));

      // 원본 바이너리 반환 (마스킹하지 않음)
      return binaryData;
    } catch (formatError) {
      manualLogger.error("Error converting binary data:", formatError);
      // 변환 실패시 빈 문서 반환
      return getBinaryDataFromHTMLString("<p></p>").contentBinary;
    }
  } catch (error) {
    manualLogger.error("Fetch error:", error);
    // API 에러시 빈 문서 반환
    return getBinaryDataFromHTMLString("<p></p>").contentBinary;
  }
};

// WebSocket 연결 시 문서 로드 핸들러도 수정
export const handleDocumentLoad = (doc: Y.Doc) => {
  try {
    // 원본 데이터 유지, 마스킹은 표시용으로만 사용
    const type = doc.getXmlFragment("default");
    const contentJSON = yXmlFragmentToProseMirrorRootNode(type, documentEditorSchema).toJSON();
    const contentHTML = generateHTML(contentJSON, DOCUMENT_EDITOR_EXTENSIONS);
    
    manualLogger.info("Document Load - Original:", contentHTML);
    manualLogger.info("Document Load - Masked (display only):", maskPersonalInfo(contentHTML));
  } catch (error) {
    manualLogger.error("Error in document load handler:", error);
    // 에러 발생시 빈 문서로 초기화
    const type = doc.getXmlFragment("default");
    type.delete(0, type.length);
    type.insert(0, [{ insert: "<p></p>" }]);
  }
};
