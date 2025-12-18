// local imports
import { gitHubEmojis, shortcodeToEmoji } from "@tiptap/extension-emoji";
import { MarkdownSerializerState } from "@tiptap/pm/markdown";
import { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { getEmojiAssetPath } from "@plane/utils";
import { Emoji } from "./emoji";
import { emojiSuggestion } from "./suggestion";

const buildFallbackImageUrl = (emojiItem: (typeof gitHubEmojis)[number]): string | undefined => {
  const fallback = emojiItem.fallbackImage;
  if (!fallback) {
    return undefined;
  }

  try {
    const url = new URL(fallback);
    const filename = url.pathname.split("/").pop();
    if (!filename) return undefined;
    const baseName = filename.replace(/\.png$/i, "");
    if (!baseName) return undefined;
    return `${getEmojiAssetPath()}/${baseName}.png`;
  } catch (error) {
    const fallbackPath = fallback.split("/").pop();
    if (!fallbackPath) return undefined;
    const baseName = fallbackPath.replace(/\.png$/i, "");
    if (!baseName) return undefined;
    return `${getEmojiAssetPath()}/${baseName}.png`;
  }
};

const proxiedGitHubEmojis = gitHubEmojis.map((emojiItem) => {
  const fallbackImage = buildFallbackImageUrl(emojiItem);
  if (!fallbackImage) return emojiItem;
  return {
    ...emojiItem,
    fallbackImage,
  };
});

export const EmojiExtension = Emoji.extend({
  addStorage() {
    const extensionOptions = this.options;

    return {
      ...this.parent?.(),
      markdown: {
        serialize(state: MarkdownSerializerState, node: ProseMirrorNode) {
          const emojiItem = shortcodeToEmoji(node.attrs.name, extensionOptions.emojis);
          if (emojiItem?.emoji) {
            state.write(emojiItem?.emoji);
          } else {
            state.write(`:${node.attrs.name}:`);
          }
        },
      },
    };
  },
}).configure({
  emojis: proxiedGitHubEmojis,
  suggestion: emojiSuggestion,
  enableEmoticons: true,
});
