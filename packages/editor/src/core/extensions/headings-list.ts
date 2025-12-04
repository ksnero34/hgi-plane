import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
// constants
import { CORE_EXTENSIONS } from "@/constants/extension";
// types
import type { IMarking } from "@/types";

export type HeadingExtensionStorage = {
  headings: IMarking[];
};

declare module "@tiptap/core" {
  interface Storage {
    [CORE_EXTENSIONS.HEADINGS_LIST]: HeadingExtensionStorage;
  }
}

export const HeadingListExtension = Extension.create<unknown, HeadingExtensionStorage>({
  name: CORE_EXTENSIONS.HEADINGS_LIST,

  addStorage() {
    return {
      headings: [] as IMarking[],
    };
  },

  addProseMirrorPlugins() {
    const plugin = new Plugin({
      key: new PluginKey("heading-list"),
      appendTransaction: (_, __, newState) => {
        const headings: IMarking[] = [];
        let h1Sequence = 0;
        let h2Sequence = 0;
        let h3Sequence = 0;
        let h4Sequence = 0;
        let h5Sequence = 0;
        let h6Sequence = 0;

        newState.doc.descendants((node) => {
          if (node.type.name === "heading") {
            const level = node.attrs.level;
            const text = node.textContent;

            let sequence = 0;
            if (level === 1) sequence = ++h1Sequence;
            else if (level === 2) sequence = ++h2Sequence;
            else if (level === 3) sequence = ++h3Sequence;
            else if (level === 4) sequence = ++h4Sequence;
            else if (level === 5) sequence = ++h5Sequence;
            else if (level === 6) sequence = ++h6Sequence;

            headings.push({
              type: "heading",
              level: level,
              text: text,
              sequence: sequence,
            });
          }
        });

        this.storage.headings = headings;

        this.editor.emit("update", {
          editor: this.editor,
          transaction: newState.tr,
        });

        return null;
      },
    });

    return [plugin];
  },

  getHeadings() {
    return this.storage.headings;
  },
});
