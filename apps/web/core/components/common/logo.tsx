import React from "react";

// define types inlined to avoid external dependency issues for now
interface ILogoProps {
  in_use: "emoji" | "icon";
  emoji?: {
    value?: string;
    url?: string;
  };
  icon?: {
    name?: string;
    color?: string;
  };
}

interface LogoProps {
  logo: ILogoProps;
  size?: number;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ logo, size = 16, className = "" }) => {
  if (!logo) return null;

  const { in_use, emoji, icon } = logo;

  if (in_use === "emoji" && emoji) {
    if (emoji.url) {
      return (
        <img
          src={emoji.url}
          alt={emoji.value || "emoji"}
          style={{ width: size, height: size }}
          className={`object-contain ${className}`}
          draggable={false}
        />
      );
    }

    return (
      <span
        style={{ fontSize: size }}
        className={`flex items-center justify-center ${className}`}
        role="img"
        aria-label={emoji.value || "emoji"}
      >
        {String.fromCodePoint(parseInt(emoji.value || "128512", 10))}
      </span>
    );
  }

  if (in_use === "icon" && icon) {
    return (
      <span className={`material-symbols-rounded ${className}`} style={{ fontSize: size, color: icon.color }}>
        {icon.name}
      </span>
    );
  }

  return null;
};
