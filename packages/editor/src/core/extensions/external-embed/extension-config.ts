import { mergeAttributes, Node } from "@tiptap/core";
// constants
import { CORE_EXTENSIONS } from "@/constants/extension";

export const ExternalEmbedExtensionConfig = Node.create({
  name: CORE_EXTENSIONS.EXTERNAL_EMBED,
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      url: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-url") ?? element.getAttribute("url") ?? "",
        renderHTML: (attributes) => {
          const url = attributes.url ?? "";
          if (!url) return {};
          return {
            "data-url": url,
            url,
          };
        },
      },
      title: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-title") ?? element.getAttribute("title") ?? "",
        renderHTML: (attributes) => {
          const title = attributes.title ?? "";
          if (!title) return {};
          return {
            "data-title": title,
            title,
          };
        },
      },
      description: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-description") ?? "",
        renderHTML: (attributes) => {
          const description = attributes.description ?? "";
          if (!description) return {};
          return {
            "data-description": description,
          };
        },
      },
      provider: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-provider") ?? "",
        renderHTML: (attributes) => {
          const provider = attributes.provider ?? "";
          if (!provider) return {};
          return {
            "data-provider": provider,
          };
        },
      },
      thumbnail: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-thumbnail") ?? "",
        renderHTML: (attributes) => {
          const thumbnail = attributes.thumbnail ?? "";
          if (!thumbnail) return {};
          return {
            "data-thumbnail": thumbnail,
          };
        },
      },
      html: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-html") ?? "",
        renderHTML: (attributes) => {
          const html = attributes.html ?? "";
          if (!html) return {};
          return {
            "data-html": html,
          };
        },
      },
      isIframe: {
        default: false,
        parseHTML: (element) => element.getAttribute("data-is-iframe") === "true" || element.classList.contains("is-iframe"),
        renderHTML: (attributes) => {
          if (!attributes.isIframe) return {};
          return {
            "data-is-iframe": "true",
            class: "is-iframe",
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "embed-component",
      },
      {
        tag: 'div[data-node="embed-component"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { url = "", title = "", provider = "" } = HTMLAttributes;
    const mergedAttributes = mergeAttributes(
      {
        class: "editor-embed-component",
        "data-node": "embed-component",
      },
      HTMLAttributes
    );

    const headline = title || provider || url;

    return [
      "embed-component",
      mergedAttributes,
      [
        "a",
        {
          href: url || "#",
          target: "_blank",
          rel: "noopener noreferrer",
        },
        headline || "Embedded content",
      ],
    ];
  },
});
