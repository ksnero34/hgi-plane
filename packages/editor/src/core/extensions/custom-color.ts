import { Mark, mergeAttributes } from "@tiptap/core";
// constants
import { COLORS_LIST } from "@/constants/common";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    color: {
      /**
       * Set the text color
       * @param {string} color The color to set
       * @example editor.commands.setTextColor('red')
       */
      setTextColor: (color: string) => ReturnType;

      /**
       * Unset the text color
       * @example editor.commands.unsetTextColor()
       */
      unsetTextColor: () => ReturnType;
      /**
       * Set the background color
       * @param {string} backgroundColor The color to set
       * @example editor.commands.setBackgroundColor('red')
       */
      setBackgroundColor: (backgroundColor: string) => ReturnType;

      /**
       * Unset the background color
       * @example editor.commands.unsetBackgroundColorColor()
       */
      unsetBackgroundColor: () => ReturnType;
    };
  }
}

export const CustomColorExtension = Mark.create({
  name: "customColor",

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          // customColor 태그에서 color 속성 또는 data-text-color 속성을 가져옴
          return element.getAttribute("color") || element.getAttribute("data-text-color");
        },
        renderHTML: (attributes: { color: string }) => {
          const { color } = attributes;
          if (!color || color === "null") {
            return {};
          }

          let elementAttributes: Record<string, string> = {
            "data-text-color": color,
          };

          if (!COLORS_LIST.find((c) => c.key === color)) {
            elementAttributes = {
              ...elementAttributes,
              style: `color: ${color}`,
            };
          }

          return elementAttributes;
        },
      },
      backgroundColor: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          // customColor 태그에서 backgroundColor 속성 또는 data-background-color 속성을 가져옴
          return element.getAttribute("backgroundColor") || element.getAttribute("data-background-color");
        },
        renderHTML: (attributes: { backgroundColor: string }) => {
          const { backgroundColor } = attributes;
          if (!backgroundColor || backgroundColor === "null") {
            return {};
          }

          let elementAttributes: Record<string, string> = {
            "data-background-color": backgroundColor,
          };

          if (!COLORS_LIST.find((c) => c.key === backgroundColor)) {
            elementAttributes = {
              ...elementAttributes,
              style: `background-color: ${backgroundColor}`,
            };
          }

          return elementAttributes;
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "customColor",
        getAttrs: (node) => {
          if (typeof node === 'string') return false;
          const element = node as HTMLElement;
          const color = element.getAttribute("color");
          const backgroundColor = element.getAttribute("backgroundColor");
          if (!color && !backgroundColor) return false;
          return null;
        },
      },
      {
        tag: "span",
        getAttrs: (node) => {
          if (typeof node === 'string') return false;
          const element = node as HTMLElement;
          const color = element.getAttribute("data-text-color");
          const backgroundColor = element.getAttribute("data-background-color");
          if (!color && !backgroundColor) return false;
          return null;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const attrs = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes);
    return ["span", attrs, 0];
  },

  addCommands() {
    return {
      setTextColor:
        (color: string) =>
        ({ chain }) =>
          chain().setMark(this.name, { color }).run(),
      unsetTextColor:
        () =>
        ({ chain }) =>
          chain().setMark(this.name, { color: null }).run(),
      setBackgroundColor:
        (backgroundColor: string) =>
        ({ chain }) =>
          chain().setMark(this.name, { backgroundColor }).run(),
      unsetBackgroundColor:
        () =>
        ({ chain }) =>
          chain().setMark(this.name, { backgroundColor: null }).run(),
    };
  },
});
