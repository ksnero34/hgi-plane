import { EmojiPicker } from "frimousse";
import { getEmojiImageUrlFromEmoji } from "@plane/utils";
import { cn } from "../utils";

type EmojiGridProps = {
  onEmojiSelect: (emoji: string) => void;
  searchPlaceholder?: string;
  searchDisabled?: boolean;
};

export const EmojiGrid = (props: EmojiGridProps) => {
  const { onEmojiSelect, searchPlaceholder = "Search", searchDisabled = false } = props;

  return (
    <EmojiPicker.Root
      data-slot="emoji-picker"
      className="isolate flex h-full w-full flex-col rounded-md border-none p-2"
      onEmojiSelect={(val) => onEmojiSelect(val.emoji)}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-custom-background-100 px-1.5 py-2 [&>[data-slot='emoji-picker-search-wrapper']]:flex-grow [&>[data-slot='emoji-picker-search-wrapper']]:p-0">
        <div data-slot="emoji-picker-search-wrapper" className="p-2">
          <EmojiPicker.Search
            placeholder={searchPlaceholder}
            disabled={searchDisabled}
            className="block h-full w-full flex-grow-0 rounded-md border-[0.5px] border-custom-border-200 bg-transparent px-3 py-2 text-[1rem] placeholder-custom-text-400 focus:border-custom-primary-100 focus:outline-none"
          />
        </div>
        <EmojiPicker.SkinToneSelector
          data-slot="emoji-picker-skin-tone-selector"
          className="mx-2 mb-1.5 size-8 flex-shrink-0 rounded-md bg-custom-background-100 text-lg hover:bg-accent"
        />
      </div>
      <EmojiPicker.Viewport data-slot="emoji-picker-content" className={cn("relative flex-1 outline-none")}>
        <EmojiPicker.List
          data-slot="emoji-picker-list"
          className="select-none pb-2"
          components={{
            CategoryHeader: ({ category, ...headerProps }) => (
              <div
                data-slot="emoji-picker-list-category-header"
                className="bg-custom-background-100 px-3 pb-1.5 text-xs font-medium text-custom-text-300"
                {...headerProps}
              >
                {category.label}
              </div>
            ),
            Row: ({ children, ...rowProps }) => (
              <div data-slot="emoji-picker-list-row" className="scroll-my-1.5 px-1.5" {...rowProps}>
                {children}
              </div>
            ),
            Emoji: ({ emoji, ...emojiProps }) => {
              const emojiImageUrl = getEmojiImageUrlFromEmoji(emoji?.emoji ?? "");
              return (
                <button
                  type="button"
                  aria-label={emoji?.label ?? emoji?.emoji}
                  data-slot="emoji-picker-list-emoji"
                  className="flex size-8 items-center justify-center rounded-md text-lg data-active:bg-accent"
                  {...emojiProps}
                >
                  {emojiImageUrl ? (
                    <img src={emojiImageUrl} alt="" className="h-6 w-6" loading="lazy" />
                  ) : (
                    emoji.emoji
                  )}
                </button>
              );
            },
          }}
        />
      </EmojiPicker.Viewport>
    </EmojiPicker.Root>
  );
};
