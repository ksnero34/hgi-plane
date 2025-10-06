import { getEmojiImageUrlFromDecimal } from "@plane/utils";

export const renderEmoji = (
  emoji:
    | string
    | {
        name: string;
        color: string;
      }
) => {
  if (!emoji) return null;

  if (typeof emoji === "object")
    return (
      <span style={{ color: emoji.color }} className="material-symbols-rounded text-lg">
        {emoji.name}
      </span>
    );

  if (Number.isNaN(parseInt(emoji, 10))) return emoji;

  const imageUrl = getEmojiImageUrlFromDecimal(emoji);

  if (!imageUrl)
    return (
      <span className="inline-flex items-center justify-center">
        {String.fromCodePoint(parseInt(emoji, 10))}
      </span>
    );

  return (
    <span className="inline-flex items-center justify-center">
      <img src={imageUrl} alt="" className="h-4 w-4" loading="lazy" />
    </span>
  );
};

export const groupReactions = <T extends { reaction: string }>(reactions: T[], key: string) => {
  const groupedReactions = reactions.reduce(
    (acc: { [key: string]: T[] }, reaction: any) => {
      if (!acc[reaction[key]]) {
        acc[reaction[key]] = [];
      }
      acc[reaction[key]].push(reaction);
      return acc;
    },
    {} as { [key: string]: T[] }
  );

  return groupedReactions;
};
