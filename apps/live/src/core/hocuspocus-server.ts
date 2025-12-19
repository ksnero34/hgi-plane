import { Server } from "@hocuspocus/server";
import * as Y from "yjs";
import { v4 as uuidv4 } from "uuid";
// editor types
import type { TUserDetails } from "@plane/editor";
import { DocumentCollaborativeEvents } from "@plane/editor/lib";
import type { TDocumentEventsServer } from "@plane/editor/lib";
// extensions
import { getExtensions } from "@/extensions";
// lib
import { handleAuthentication } from "@/lib/auth";
import { maskPrivateInformation } from "@/core/utils/privacy-masking";
// types
import type { HocusPocusServerContext } from "@/types";

export const getHocusPocusServer = async () => {
  const extensions = await getExtensions();
  const serverName = process.env.HOSTNAME || uuidv4();


  const processTextNode = (textNode: Y.XmlText): boolean => {
    const delta = textNode.toDelta();
    let hasChanges = false;

    const maskedDelta = delta.map((part: any) => {
      if (typeof part.insert === "string") {
        const maskedText = maskPrivateInformation(part.insert);
        if (maskedText !== part.insert) {
          hasChanges = true;
          return part.attributes ? { insert: maskedText, attributes: part.attributes } : { insert: maskedText };
        }
      }
      return part;
    });

    if (hasChanges) {
      textNode.delete(0, textNode.length);
      textNode.applyDelta(maskedDelta);
    }

    return hasChanges;
  };

  const processElement = (element: Y.XmlElement): boolean => {
    let hasChanges = false;

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
      } catch (_error) {
        throw Error("Authentication unsuccessful!");
      }
    },
    async onStateless({ payload, document }) {
      // broadcast the client event (derived from the server event) to all the clients so that they can update their state
      const response = DocumentCollaborativeEvents[payload as TDocumentEventsServer].client;
      if (response) {
        document.broadcastStateless(response);
      }
    },
    extensions,
    onChange: async (data) => {
      try {
        const document = data instanceof Y.Doc ? data : data.document;

        if (document instanceof Y.Doc) {
          const xmlFragment = document.getXmlFragment("default");
          if (!xmlFragment) return;

          document.transact(() => {
            const yElements = Array.from(xmlFragment.toArray());
            let hasChanges = false;

            yElements.forEach((yElement) => {
              if (yElement instanceof Y.XmlElement) {
                if (processElement(yElement)) {
                  hasChanges = true;
                }
              }
            });

            if (hasChanges) {
              // console.log("[Hocuspocus] Document updated with masked content");
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
