import * as React from "react";
import { AnimatedCounter } from "../animated-counter";
import { stringToEmoji } from "../emoji-icon-picker";
import { AddReactionIcon } from "../icons";
import { getEmojiImageUrlCandidatesFromDecimal } from "@plane/utils";
import { Tooltip } from "../tooltip";
import { cn } from "../utils";

export interface EmojiReactionType {
  emoji: string;
  count: number;
  reacted?: boolean;
  users?: string[];
}

export interface EmojiReactionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  emoji: string;
  count: number;
  reacted?: boolean;
  users?: string[];
  onReactionClick?: (emoji: string) => void;
  className?: string;
  showCount?: boolean;
  size?: "sm" | "md" | "lg";
}

export interface EmojiReactionGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  reactions: EmojiReactionType[];
  onReactionClick?: (emoji: string) => void;
  onAddReaction?: () => void;
  className?: string;
  showAddButton?: boolean;
  maxDisplayUsers?: number;
}

export interface EmojiReactionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onAddReaction?: () => void;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: {
    button: "h-5 px-1.5 text-xs gap-1",
    emoji: "text-xs",
    count: "text-[10px]",
  },
  md: {
    button: "h-6 px-2 text-sm gap-1.5",
    emoji: "text-sm",
    count: "text-xs",
  },
  lg: {
    button: "h-7 px-2.5 text-base gap-2",
    emoji: "text-base",
    count: "text-sm",
  },
};

const EmojiReaction = React.forwardRef<HTMLButtonElement, EmojiReactionProps>(
  (
    { emoji, count, reacted = false, users = [], onReactionClick, className, showCount = true, size = "md", ...props },
    ref
  ) => {
    const sizeClass = sizeClasses[size] || sizeClasses.md;
    const emojiImageCandidates = React.useMemo(() => getEmojiImageUrlCandidatesFromDecimal(emoji), [emoji]);
    const [emojiCandidateIndex, setEmojiCandidateIndex] = React.useState(0);

    React.useEffect(() => {
      setEmojiCandidateIndex(0);
    }, [emojiImageCandidates]);

    const handleEmojiImageError = React.useCallback(() => {
      setEmojiCandidateIndex((index) => {
        const nextIndex = index + 1;
        return nextIndex < emojiImageCandidates.length ? nextIndex : -1;
      });
    }, [emojiImageCandidates]);

    const hasEmojiImage = emojiCandidateIndex >= 0 && emojiCandidateIndex < emojiImageCandidates.length;
    const emojiImageUrl = hasEmojiImage ? emojiImageCandidates[emojiCandidateIndex] : "";

    const handleClick = () => {
      onReactionClick?.(emoji);
    };

    const tooltipContent = React.useMemo(() => {
      if (!users.length) return null;

      const displayUsers = users.slice(0, 5);
      const remainingCount = users.length - displayUsers.length;

      return (
        <div className="text-xs">
          <div className="font-medium mb-1 inline-flex items-center gap-1">
            {emojiImageUrl ? (
              <img src={emojiImageUrl} alt="" className="h-4 w-4" loading="lazy" onError={handleEmojiImageError} />
            ) : (
              stringToEmoji(emoji)
            )}
          </div>
          <div>
            {displayUsers.join(", ")}
            {remainingCount > 0 && ` and ${remainingCount} more`}
          </div>
        </div>
      );
    }, [emoji, users, emojiImageUrl, handleEmojiImageError]);

    const imageDimension = size === "sm" ? 16 : size === "md" ? 18 : 20;

    const button = (
      <button
        ref={ref}
        onClick={handleClick}
        className={cn(
          "inline-flex items-center rounded-full border transition-all duration-200 hover:scale-105",
          "focus:outline-none focus:ring-2 focus:ring-custom-primary-100/20 focus:ring-offset-1",
          sizeClass.button,
          reacted
            ? "bg-custom-primary-100/10 border-custom-primary-100 text-custom-primary-100"
            : "bg-custom-background-100 border-custom-border-200 text-custom-text-300 hover:border-custom-border-300 hover:bg-custom-background-90",
          className
        )}
        {...props}
      >
        <span className={cn(sizeClass.emoji, "inline-flex items-center justify-center")} aria-hidden>
          {emojiImageUrl ? (
            <img
              src={emojiImageUrl}
              alt=""
              style={{ height: imageDimension, width: imageDimension }}
              loading="lazy"
              onError={handleEmojiImageError}
            />
          ) : (
            stringToEmoji(emoji)
          )}
        </span>
        {showCount && count > 0 && <AnimatedCounter count={count} size={size} className={sizeClass.count} />}
      </button>
    );

    if (tooltipContent && users.length > 0) {
      return <Tooltip tooltipContent={tooltipContent}>{button}</Tooltip>;
    }

    return button;
  }
);

const EmojiReactionButton = React.forwardRef(function EmojiReactionButton(
  { onAddReaction, className, ...props }: EmojiReactionButtonProps,
  ref: React.ForwardedRef<HTMLButtonElement>
) {
  return (
    <button
      ref={ref}
      onClick={onAddReaction}
      className={cn(
        "inline-flex items-center justify-center rounded-full border border-dashed border-custom-border-300",
        "bg-custom-background-100 text-custom-text-400 transition-all duration-200",
        "hover:border-custom-primary-100 hover:text-custom-primary-100 hover:bg-custom-primary-100/5",
        "focus:outline-none focus:ring-2 focus:ring-custom-primary-100/20 focus:ring-offset-1",
        "h-6 w-6",
        className
      )}
      title="Add reaction"
      {...props}
    >
      <AddReactionIcon className="h-3 w-3" />
    </button>
  );
});

const EmojiReactionGroup = React.forwardRef(function EmojiReactionGroup(
  {
    reactions,
    onReactionClick,
    onAddReaction,
    className,
    showAddButton = true,
    maxDisplayUsers = 5,
    ...props
  }: EmojiReactionGroupProps,
  ref: React.ForwardedRef<HTMLDivElement>
) {
  return (
    <div ref={ref} className={cn("flex flex-wrap items-center gap-2", className)} {...props}>
      {reactions.map((reaction, index) => (
        <EmojiReaction
          key={`${reaction.emoji}-${index}`}
          emoji={reaction.emoji}
          count={reaction.count}
          reacted={reaction.reacted}
          users={reaction.users?.slice(0, maxDisplayUsers)}
          onReactionClick={onReactionClick}
        />
      ))}
      {showAddButton && <EmojiReactionButton onAddReaction={onAddReaction} />}
    </div>
  );
});

EmojiReaction.displayName = "EmojiReaction";
EmojiReactionButton.displayName = "EmojiReactionButton";
EmojiReactionGroup.displayName = "EmojiReactionGroup";

export { EmojiReaction, EmojiReactionButton, EmojiReactionGroup };
