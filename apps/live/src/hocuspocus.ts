import { Hocuspocus } from "@hocuspocus/server";
import { v4 as uuidv4 } from "uuid";
import * as Y from "yjs";
// env
import { env } from "@/env";
// extensions
import { getExtensions } from "@/extensions";
// lib
import { onAuthenticate } from "@/lib/auth";
import { onStateless } from "@/lib/stateless";
import { maskPrivateInformation } from "@/core/utils/privacy-masking";

export class HocusPocusServerManager {
  private static instance: HocusPocusServerManager | null = null;
  private server: Hocuspocus | null = null;
  // server options
  private serverName = env.HOSTNAME || uuidv4();

  private constructor() {
    // Private constructor to prevent direct instantiation
  }

  /**
   * Get the singleton instance of HocusPocusServerManager
   */
  public static getInstance(): HocusPocusServerManager {
    if (!HocusPocusServerManager.instance) {
      HocusPocusServerManager.instance = new HocusPocusServerManager();
    }
    return HocusPocusServerManager.instance;
  }

  /**
   * Initialize and configure the HocusPocus server
   */
  public async initialize(): Promise<Hocuspocus> {
    if (this.server) {
      return this.server;
    }

    this.server = new Hocuspocus({
      name: this.serverName,
      onAuthenticate,
      onStateless,
      extensions: getExtensions(),
      debounce: 1000,
      onChange: async (data) => {
        try {
          const document = data instanceof Y.Doc ? data : data.document;

          if (document instanceof Y.Doc) {
            const xmlFragment = document.getXmlFragment("default");
            if (!xmlFragment) return;

            // Define processing functions inline or as class methods (migrated logic)
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
                  if (processTextNode(item)) hasChanges = true;
                } else if (item instanceof Y.XmlElement) {
                  if (processElement(item)) hasChanges = true;
                }
              }
              return hasChanges;
            };

            document.transact(() => {
              const yElements = Array.from(xmlFragment.toArray());
              let hasChanges = false;
              yElements.forEach((yElement) => {
                if (yElement instanceof Y.XmlElement) {
                  if (processElement(yElement)) hasChanges = true;
                }
              });
              if (hasChanges) {
                 // console.log("[Hocuspocus] Masking applied");
              }
            });
          }
        } catch (error) {
          console.error("[Hocuspocus] Error during document change:", error);
        }
      },
    });

    return this.server;
  }

  /**
   * Get the configured server instance
   */
  public getServer(): Hocuspocus | null {
    return this.server;
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  public static resetInstance(): void {
    HocusPocusServerManager.instance = null;
  }
}
