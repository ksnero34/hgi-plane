// plane helpers
import { sanitizeHTML } from "@plane/utils";
// plane ui
import { TEmojiLogoProps } from "@plane/ui";
// types
import {
  EAttributeNames,
  TCalloutBlockAttributes,
  TCalloutBlockEmojiAttributes,
  TCalloutBlockIconAttributes,
} from "./types";

export const DEFAULT_CALLOUT_BLOCK_ATTRIBUTES: TCalloutBlockAttributes = {
  "data-logo-in-use": "emoji",
  "data-icon-color": undefined,
  "data-icon-name": undefined,
  "data-emoji-unicode": "128161",
  // "data-emoji-url": "https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f4a1.png",
  "data-background": "",
  "data-block-type": "callout-component",
};

type TStoredLogoValue = Pick<TCalloutBlockAttributes, EAttributeNames.LOGO_IN_USE> &
  (TCalloutBlockEmojiAttributes | TCalloutBlockIconAttributes);

// function to get the stored logo from local storage
export const getStoredLogo = (): TEmojiLogoProps => {
  const storedLogo = localStorage.getItem("stored-logo");
  if (!storedLogo) return DEFAULT_CALLOUT_BLOCK_ATTRIBUTES;

  try {
    const parsedData = JSON.parse(storedLogo);
    return {
      in_use: parsedData.in_use || DEFAULT_CALLOUT_BLOCK_ATTRIBUTES["data-logo-in-use"],
      emoji: {
        value: parsedData.emoji?.value || DEFAULT_CALLOUT_BLOCK_ATTRIBUTES["data-emoji-unicode"],
      },
      icon: parsedData.icon || {
        name: undefined,
        color: undefined,
      },
    };
  } catch (error) {
    return DEFAULT_CALLOUT_BLOCK_ATTRIBUTES;
  }
};

// function to update the stored logo on local storage
export const updateStoredLogo = (logo: TEmojiLogoProps) => {
  localStorage.setItem("stored-logo", JSON.stringify(logo));
};

// function to get the stored background color from local storage
export const getStoredBackgroundColor = (): string | null => {
  if (typeof window !== "undefined") {
    return sanitizeHTML(localStorage.getItem("editor-calloutComponent-background"));
  }
  return null;
};

// function to update the stored background color on local storage
export const updateStoredBackgroundColor = (value: string | null): void => {
  if (typeof window === "undefined") return;
  if (value === null) {
    localStorage.removeItem("editor-calloutComponent-background");
    return;
  } else {
    localStorage.setItem("editor-calloutComponent-background", value);
  }
};
