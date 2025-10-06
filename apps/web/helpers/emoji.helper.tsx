import { getEmojiImageUrlFromDecimal } from "@plane/utils";

/**
 * Renders an emoji or icon
 * @param {string | { name: string; color: string }} emoji - The emoji or icon to render
 * @returns {React.ReactNode} The rendered emoji or icon
 */
export const renderEmoji = (
  emoji:
    | string
    | {
        name: string;
        color: string;
      }
): React.ReactNode => {
  if (!emoji) return;

  if (typeof emoji === "object")
    return (
      <span style={{ fontSize: "16px", color: emoji.color }} className="material-symbols-rounded">
        {emoji.name}
      </span>
    );

  if (Number.isNaN(parseInt(emoji, 10))) return emoji;

  const imageUrl = getEmojiImageUrlFromDecimal(emoji);

  if (!imageUrl) return String.fromCodePoint(parseInt(emoji, 10));

  return (
    <span className="emoji-container inline-flex items-center justify-center">
      <img src={imageUrl} alt="" className="h-4 w-4" loading="lazy" />
    </span>
  );
};
