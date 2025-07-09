// types
import { TLogoProps } from "@plane/types";
import { Emoji, EmojiStyle } from "emoji-picker-react";
// helpers
import { cn } from "@/helpers/common.helper";
import { emojiCodeToUnicode } from "@plane/utils";

type Props = {
  className?: string;
  logo: TLogoProps;
};

export const ProjectLogo: React.FC<Props> = (props) => {
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

  if (logo.in_use === "emoji" && logo.emoji)
    return (
      <div className={cn("emoji-container", className)}>
        <Emoji 
          unified={emojiCodeToUnicode(logo.emoji.value || "")} 
          size={16} 
          emojiStyle={EmojiStyle.NATIVE} 
        />
      </div>
    );

  return <span />;
};
