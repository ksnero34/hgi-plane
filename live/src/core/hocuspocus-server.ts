import { Server } from "@hocuspocus/server";
import { v4 as uuidv4 } from "uuid";
import * as Y from "yjs";
// lib
import { handleAuthentication } from "@/core/lib/authentication.js";
// extensions
import { getExtensions } from "@/core/extensions/index.js";
// utils
import { maskPrivateInformation } from "@/core/utils/privacy-masking.js";
// types
import {
  DocumentCollaborativeEvents,
  TDocumentEventsServer,
} from "@plane/editor/lib";
// types
import { type HocusPocusServerContext } from "@/core/types/common.js";

export const getHocusPocusServer = async () => {
  const extensions = await getExtensions();
  const serverName = process.env.HOSTNAME || uuidv4();
  
  let lastUpdateTime = 0;
  const UPDATE_INTERVAL = 1000;

  const processTextNode = (textNode: Y.XmlText): boolean => {
    const text = textNode.toString();
    //console.log("[Hocuspocus] 텍스트 노드 마스킹 처리 전:", text);
    
    // customColor 태그가 포함된 경우, 태그 내부의 텍스트만 추출하여 마스킹
    if (text.includes('<customColor')) {
      //console.log("[Hocuspocus] customColor 태그 발견, 파싱 시작");
      const match = text.match(/<customColor([^>]*)>([^<]+)<\/customColor>/);
      if (match) {
        const [fullMatch, attributes, innerText] = match;
        //console.log("[Hocuspocus] customColor 태그 파싱 결과:", {
        //   attributes,
        //   innerText
        // });
        
        const maskedInnerText = maskPrivateInformation(innerText);
        //console.log("[Hocuspocus] 마스킹된 내부 텍스트:", maskedInnerText);
        
        if (maskedInnerText !== innerText) {
          try {
            // 속성 파싱
            const bgMatch = attributes.match(/backgroundColor="([^"]+)"/);
            const colorMatch = attributes.match(/color="([^"]+)"/);
            const backgroundColor = bgMatch ? bgMatch[1] : null;
            const color = colorMatch ? colorMatch[1] : null;
            
            // 새로운 customColor 태그 생성
            const newText = `<customColor${attributes}>${maskedInnerText}</customColor>`;
            //console.log("[Hocuspocus] 새로 생성된 텍스트:", newText);
            
            // 기존 텍스트 교체
            const length = textNode.length;
            textNode.delete(0, length);
            textNode.insert(0, newText);
            
            //console.log("[Hocuspocus] customColor 텍스트 교체 완료");
            return true;
          } catch (error) {
            console.error("[Hocuspocus] Error processing customColor text:", error);
            return false;
          }
        }
      } else {
        //console.log("[Hocuspocus] customColor 태그 파싱 실패");
      }
      return false;
    }
    
    const maskedText = maskPrivateInformation(text);
    //console.log("[Hocuspocus] 텍스트 노드 마스킹 처리 후:", maskedText);
    
    if (maskedText !== text) {
      const length = textNode.length;
      textNode.delete(0, length);
      textNode.insert(0, maskedText);
      return true;
    }
    return false;
  };

  const processElement = (element: Y.XmlElement): boolean => {
    let hasChanges = false;

    // customColor 태그 내부의 텍스트만 마스킹
    if (element.nodeName === 'customColor') {
      //console.log("[Hocuspocus] customColor 엘리먼트 처리 시작");
      let fullText = '';
      
      // 내부 텍스트만 추출
      for (let i = 0; i < element.length; i++) {
        const item = element.get(i);
        if (item instanceof Y.XmlText) {
          fullText += item.toString();
        }
      }
      
      //console.log("[Hocuspocus] 마스킹 처리 전 텍스트:", fullText);
      const maskedText = maskPrivateInformation(fullText);
      //console.log("[Hocuspocus] 마스킹 처리 후 텍스트:", maskedText);
      
      if (maskedText !== fullText) {
        try {
          //console.log("[Hocuspocus] 마스킹 변환 시작");
          
          // 기존 텍스트 노드 찾기
          for (let i = 0; i < element.length; i++) {
            const item = element.get(i);
            if (item instanceof Y.XmlText) {
              // 기존 텍스트 노드의 내용만 업데이트
              const length = item.length;
              item.delete(0, length);
              item.insert(0, maskedText);
              hasChanges = true;
              break;
            }
          }
          
          //console.log("[Hocuspocus] 마스킹 변환 완료");
        } catch (error) {
          console.error("[Hocuspocus] Error processing customColor element:", error);
        }
      } else {
        //console.log("[Hocuspocus] 마스킹 처리가 필요하지 않음 (텍스트 동일)");
      }
      return hasChanges;
    }

    // 다른 요소들의 자식 노드 처리
    for (let i = 0; i < element.length; i++) {
      const item = element.get(i);
      
      if (item instanceof Y.XmlText) {
        if (processTextNode(item)) {
          hasChanges = true;
        }
      } else if (item instanceof Y.XmlElement) {
        if (processElement(item)) {
          hasChanges = true;
        }
      }
    }

    return hasChanges;
  };

  // 마스킹된 텍스트를 처리하는 함수
  const maskSensitiveContent = (text: string) => {
    // customColor 태그 내부의 내용만 변환
    return text.replace(
      /(<customColor[^>]*>)(.*?)(<\/customColor>)/g,
      (match, openTag, content, closeTag) => {
        // 전화번호 마스킹
        const maskedContent = content.replace(
          /(\d{3})-?(\d{4})-?(\d{4})/g,
          '$1-****-$3'
        );
        return openTag + maskedContent + closeTag;
      }
    );
  };

  return Server.configure({
    name: serverName,
    onAuthenticate: async ({
      requestHeaders,
      context,
      token,
    }) => {
      let cookie: string | undefined = undefined;
      let userId: string | undefined = undefined;

      try {
        const parsedToken = JSON.parse(token) as TUserDetails;
        userId = parsedToken.id;
        cookie = parsedToken.cookie;
      } catch (error) {
        console.error("Token parsing failed, using request headers:", error);
      } finally {
        if (!cookie) {
          cookie = requestHeaders.cookie?.toString();
        }
      }

      if (!cookie || !userId) {
        throw new Error("Credentials not provided");
      }

      (context as HocusPocusServerContext).cookie = cookie;

      try {
        await handleAuthentication({
          cookie,
          userId,
        });
      } catch (error) {
        throw Error("Authentication unsuccessful!");
      }
    },
    async onStateless({ payload, document }) {
      const response =
        DocumentCollaborativeEvents[payload as TDocumentEventsServer].client;
      if (response) {
        document.broadcastStateless(response);
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

          document.transact(() => {
            const yElements = Array.from(xmlFragment.toArray());
            let hasChanges = false;
            
            yElements.forEach(yElement => {
              if (yElement instanceof Y.XmlElement) {
                if (processElement(yElement)) {
                  hasChanges = true;
                }
              }
            });

            if (hasChanges) {
              //console.log("[Hocuspocus] Document updated with masked content");
            }
          });
        } else {
          console.error("[Hocuspocus] Invalid document format:", typeof document);
        }
      } catch (error) {
        console.error("[Hocuspocus] Error during document change:", error);
      }
    },
  });
};
