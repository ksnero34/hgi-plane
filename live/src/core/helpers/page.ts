import { getSchema } from "@tiptap/core";
import { generateHTML, generateJSON } from "@tiptap/html";
import { prosemirrorJSONToYDoc, yXmlFragmentToProseMirrorRootNode } from "y-prosemirror";
import * as Y from "yjs"
import { manualLogger } from "./logger.js";
import { maskPersonalInfo } from './masking.js';
// plane editor
import { CoreEditorExtensionsWithoutProps, DocumentEditorExtensionsWithoutProps } from "@plane/editor/lib";

const DOCUMENT_EDITOR_EXTENSIONS = [
  ...CoreEditorExtensionsWithoutProps,
  ...DocumentEditorExtensionsWithoutProps,
];
const documentEditorSchema = getSchema(DOCUMENT_EDITOR_EXTENSIONS);

export const getAllDocumentFormatsFromBinaryData = (description: Uint8Array) => {
  manualLogger.info("\n=== Converting Binary to Document Formats ===");
  manualLogger.info("Input binary size:", description.length);

  // encode binary description data
  const base64Data = Buffer.from(description).toString("base64");
  manualLogger.info("Base64 encoded size:", base64Data.length);

  const yDoc = new Y.Doc();
  Y.applyUpdate(yDoc, description);
  
  // convert to JSON
  const type = yDoc.getXmlFragment("default");
  const contentJSON = yXmlFragmentToProseMirrorRootNode(
    type,
    documentEditorSchema
  ).toJSON();
  
  // convert to HTML and apply masking
  const contentHTML = generateHTML(contentJSON, DOCUMENT_EDITOR_EXTENSIONS);
  const maskedHTML = maskPersonalInfo(contentHTML);

  // 마스킹된 HTML을 다시 JSON으로 변환
  const maskedJSON = generateJSON(maskedHTML, DOCUMENT_EDITOR_EXTENSIONS);

  // 마스킹된 JSON을 Y.Doc에 적용
  const maskedDoc = prosemirrorJSONToYDoc(documentEditorSchema, maskedJSON, "default");
  const maskedBinary = Y.encodeStateAsUpdate(maskedDoc);
  const maskedBase64 = Buffer.from(maskedBinary).toString("base64");

  manualLogger.info("Content Details:");
  manualLogger.info("-".repeat(30));
  manualLogger.info("Original HTML:", contentHTML);
  manualLogger.info("Masked HTML:", maskedHTML);
  manualLogger.info("=== End of Conversion ===\n");

  return {
    contentBinaryEncoded: maskedBase64,  // 마스킹된 바이너리
    contentJSON: maskedJSON,  // 마스킹된 JSON
    contentHTML: maskedHTML,  // 마스킹된 HTML
  };
}

export const getBinaryDataFromHTMLString = (descriptionHTML: string): {
  contentBinary: Uint8Array
} => {
  manualLogger.info("\n=== Converting HTML to Binary ===");
  manualLogger.info("Input HTML:", descriptionHTML);

  // convert HTML to JSON
  const contentJSON = generateJSON(
    descriptionHTML ?? "<p></p>",
    DOCUMENT_EDITOR_EXTENSIONS
  );
  manualLogger.info("Generated JSON:", JSON.stringify(contentJSON).slice(0, 200) + "...");
  
  // convert JSON to Y.Doc format
  const transformedData = prosemirrorJSONToYDoc(
    documentEditorSchema,
    contentJSON,
    "default"
  );
  
  // convert Y.Doc to Uint8Array format
  const encodedData = Y.encodeStateAsUpdate(transformedData);
  manualLogger.info("Output binary size:", encodedData.length);
  manualLogger.info("=== End of Conversion ===\n");

  return {
    contentBinary: encodedData
  }
}