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
    const maskedText = maskPrivateInformation(text);
    
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
      let fullText = '';
      for (let i = 0; i < element.length; i++) {
        const item = element.get(i);
        if (item instanceof Y.XmlText) {
          fullText += item.toString();
        }
      }
      
      const maskedText = maskPrivateInformation(fullText);
      if (maskedText !== fullText) {
        // 기존 내용 삭제
        while (element.length > 0) {
          element.delete(0, 1);
        }
        // 마스킹된 텍스트 추가
        element.push([new Y.XmlText(maskedText)]);
        hasChanges = true;
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
              console.log("[Hocuspocus] Document updated with masked content");
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
