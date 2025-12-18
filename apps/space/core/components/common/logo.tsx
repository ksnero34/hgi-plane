import type { FC } from "react";
// plane imports
import { TLogoProps } from "@plane/types";
import { LUCIDE_ICONS_LIST } from "@plane/ui";
import { getEmojiImageUrlFromDecimal } from "@plane/utils";

type Props = {
  logo: TLogoProps;
  size?: number;
  type?: "lucide" | "material";
};

export const Logo: FC<Props> = (props) => {
  const { logo, size = 16, type = "material" } = props;

  // destructuring the logo object
  const { in_use, emoji, icon } = logo;

  // derived values
  const value = in_use === "emoji" ? emoji?.value : icon?.name;
  const color = icon?.color;
  const lucideIcon = LUCIDE_ICONS_LIST.find((item) => item.name === value);

  // if no value, return empty fragment
  if (!value) return <></>;

  // emoji
  if (in_use === "emoji") {
    const imageUrl = emoji?.url || getEmojiImageUrlFromDecimal(value || "");
    if (imageUrl) return <img src={imageUrl} alt="" style={{ height: size, width: size }} loading="lazy" />;

    const codePoints = (value || "")
      .split("-")
      .map((segment) => parseInt(segment, 10))
      .filter((segment) => !Number.isNaN(segment));

    if (codePoints.length) {
      return (
        <span
          className="grid place-items-center"
          style={{
            width: size,
            height: size,
            fontSize: size * 0.9,
            lineHeight: 1,
          }}
          aria-label="logo-emoji"
          role="img"
        >
          {String.fromCodePoint(...codePoints)}
        </span>
      );
    }

    return null;
  }

  // icon
  if (in_use === "icon") {
    return (
      <>
        {type === "lucide" ? (
          <>
            {lucideIcon && (
              <lucideIcon.element
                style={{
                  color: color,
                  height: size,
                  width: size,
                }}
              />
            )}
          </>
        ) : (
          <span
            className="material-symbols-rounded"
            style={{
              fontSize: size,
              color: color,
              scale: "115%",
            }}
          >
            {value}
          </span>
        )}
      </>
    );
  }

  // if no value, return empty fragment
  return <></>;
};
