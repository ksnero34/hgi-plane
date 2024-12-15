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
import {
  DocumentCollaborativeEvents,
  TDocumentEventsServer,
} from "@plane/editor/lib";
// editor types
import { TUserDetails } from "@plane/editor";
// types
import { type HocusPocusServerContext } from "@/core/types/common.js";

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
    onAuthenticate: async ({
      requestHeaders,
      context,
      // user id used as token for authentication
      token,
    }) => {
      let cookie: string | undefined = undefined;
      let userId: string | undefined = undefined;

      // Extract cookie (fallback to request headers) and userId from token (for scenarios where
      // the cookies are not passed in the request headers)
      try {
        const parsedToken = JSON.parse(token) as TUserDetails;
        userId = parsedToken.id;
        cookie = parsedToken.cookie;
      } catch (error) {
        // If token parsing fails, fallback to request headers
        console.error("Token parsing failed, using request headers:", error);
      } finally {
        // If cookie is still not found, fallback to request headers
        if (!cookie) {
          cookie = requestHeaders.cookie?.toString();
        }
      }

      if (!cookie || !userId) {
        throw new Error("Credentials not provided");
      }

      // set cookie in context, so it can be used throughout the ws connection
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
      // broadcast the client event (derived from the server event) to all the clients so that they can update their state
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
