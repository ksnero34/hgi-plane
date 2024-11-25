import { Server } from "@hocuspocus/server";
import { v4 as uuidv4 } from "uuid";
import * as Y from "yjs";
import { JSDOM } from 'jsdom';
// lib
import { handleAuthentication } from "@/core/lib/authentication.js";
// extensions
import { getExtensions } from "@/core/extensions/index.js";
// utils
import { maskPrivateInformation } from "@/core/utils/privacy-masking.js";

export const getHocusPocusServer = async () => {
  const extensions = await getExtensions();
  const serverName = process.env.HOSTNAME || uuidv4();
  
  let lastUpdateTime = 0;
  const UPDATE_INTERVAL = 1000;

  const ELEMENT_NODE = 1;
  const TEXT_NODE = 3;

  const processTextContent = (text: string): string => {
    return maskPrivateInformation(text);
  };

  const updateYXmlElementContent = (yElement: Y.XmlElement) => {
    // paragraph나 다른 요소의 텍스트 내용을 직접 마스킹
    if (yElement.length > 0 && yElement.toString()) {
      const content = yElement.toString();
      // HTML 태그를 제외한 텍스트 내용만 추출
      const textMatch = content.match(/>([^<]*)</);
      if (textMatch && textMatch[1]) {
        const originalText = textMatch[1];
        const maskedText = processTextContent(originalText);
        
        if (maskedText !== originalText) {
          // 기존 내용을 유지하면서 텍스트만 교체
          const newContent = content.replace(
            `>${originalText}<`, 
            `>${maskedText}<`
          );
          
          // 요소의 내용을 새로운 내용으로 업데이트
          yElement.delete(0, yElement.length);
          const dom = new JSDOM(newContent);
          const newElement = dom.window.document.body.firstChild;
          
          if (newElement) {
            // 속성 복사
            const attrs = yElement.getAttributes();
            yElement.insert(0, [new Y.XmlText(maskedText)]);
            if (attrs) {
              Object.entries(attrs).forEach(([name, value]) => {
                yElement.setAttribute(name, value);
              });
            }
          }
        }
      }
    }

    // 자식 요소들도 재귀적으로 처리
    const children = Array.from(yElement.toArray());
    children.forEach(child => {
      if (child instanceof Y.XmlElement) {
        updateYXmlElementContent(child);
      }
    });
  };

  return Server.configure({
    name: serverName,
    onAuthenticate: async ({ requestHeaders, token }) => {
      const cookie = requestHeaders.cookie?.toString();

      if (!cookie) {
        throw Error("Credentials not provided");
      }

      try {
        await handleAuthentication({
          cookie,
          token,
        });
      } catch (error) {
        throw Error("Authentication unsuccessful!");
      }
    },
    extensions,
    debounce: 1000,
    onChange: async (data) => {
      try {
        const now = Date.now();
        if (now - lastUpdateTime < UPDATE_INTERVAL) {
          return;
        }
        lastUpdateTime = now;

        const document = data instanceof Y.Doc ? data : data.document;
        
        if (document instanceof Y.Doc) {
          const xmlFragment = document.getXmlFragment("default");
          if (!xmlFragment) return;

          try {
            document.transact(() => {
              const yElements = Array.from(xmlFragment.toArray());
              yElements.forEach(yElement => {
                if (yElement instanceof Y.XmlElement) {
                  updateYXmlElementContent(yElement);
                }
              });
            });
          } catch (error) {
            console.error("[Hocuspocus] Error updating document:", error);
          }
        } else {
          console.error("[Hocuspocus] Invalid document format:", typeof document);
        }
      } catch (error) {
        console.error("[Hocuspocus] Error during document change:", error);
      }
    },
  });
};
