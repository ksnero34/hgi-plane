import { Emoji, EmojiStyle } from "emoji-picker-react";
// helpers
import { emojiCodeToUnicode } from "@plane/utils";

export const renderEmoji = (
  emoji:
    | string
    | {
        name: string;
        color: string;
      }
) => {
  if (!emoji) return;

  if (typeof emoji === "object")
    return (
      <span style={{ color: emoji.color }} className="material-symbols-rounded text-lg">
        {emoji.name}
      </span>
    );
  else {
    if (isNaN(parseInt(emoji))) return emoji;
    return (
      <div className="emoji-container">
        <Emoji unified={emojiCodeToUnicode(emoji)} size={16} emojiStyle={EmojiStyle.NATIVE} />
      </div>
    );
  }
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
