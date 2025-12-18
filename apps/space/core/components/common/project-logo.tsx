// types
import type { TLogoProps } from "@plane/types";
// helpers
import { cn, getEmojiImageUrlFromDecimal } from "@plane/utils";

type Props = {
  className?: string;
  logo: TLogoProps;
};

export function ProjectLogo(props: Props) {
  const { className, logo } = props;

  if (logo.in_use === "icon" && logo.icon)
    return (
      <span
        style={{
          color: logo.icon.color,
        }}
        className={cn("material-symbols-rounded text-base", className)}
      >
        {logo.icon.name}
      </span>
    );

  if (logo.in_use === "emoji" && logo.emoji) {
    const imageUrl = logo.emoji.url || getEmojiImageUrlFromDecimal(logo.emoji.value || "");
    if (imageUrl) return <img src={imageUrl} alt="" className={cn("h-4 w-4", className)} loading="lazy" />;

    return (
      <span className={cn("text-base", className)}>
        {logo.emoji.value?.split("-").map((emoji) => String.fromCodePoint(parseInt(emoji, 10)))}
      </span>
    );
  }

  return <span />;
}
