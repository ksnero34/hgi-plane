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
  
  // 마지막 업데이트 시간을 추적
  let lastUpdateTime = 0;
  const UPDATE_INTERVAL = 1000; // 1초

  return Server.configure({
    name: serverName,
    onAuthenticate: async ({
      requestHeaders,
      token,
    }) => {
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
          // 현재 문서 내용을 가져옴
          const xmlFragment = document.getXmlFragment("default");
          if (!xmlFragment) return;

          // 현재 내용을 문자열로 변환
          const currentContent = xmlFragment.toString();
          
          // 마스킹 처리
          const maskedContent = maskPrivateInformation(currentContent);

          // 마스킹된 내용이 다른 경우에만 업데이트
          if (maskedContent !== currentContent) {
            try {
              document.transact(() => {
                // 기존 내용 삭제
                xmlFragment.delete(0, xmlFragment.length);
                
                // JSDOM을 사용하여 HTML 파싱
                const dom = new JSDOM(maskedContent);
                const elements = Array.from(dom.window.document.body.children);
                
                // 각 요소를 YXmlElement로 변환하여 추가
                elements.forEach(element => {
                  const yElement = new Y.XmlElement(element.tagName.toLowerCase());
                  if (element.textContent) {
                    yElement.insert(0, [new Y.XmlText(element.textContent)]);
                  }
                  xmlFragment.push([yElement]);
                });
              });

              console.log("[Hocuspocus] Document updated with masked content");
            } catch (error) {
              console.error("[Hocuspocus] Error updating document:", error);
            }
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
