"use client";

// plane imports
import { RANDOM_EMOJI_CODES } from "@plane/constants";

const DEFAULT_EMOJI_ASSET_PATH = "/emoji-apple";

const formatUnicodeSegment = (codePoint: number): string => {
  if (!Number.isFinite(codePoint)) return "";
  const hex = codePoint.toString(16).toLowerCase();
  return hex.length >= 4 ? hex : hex.padStart(4, "0");
};

const getEmojiAssetBasePath = (): string => {
  if (typeof process !== "undefined") {
    const configured =
      process.env.NEXT_PUBLIC_EMOJI_ASSET_PATH ||
      process.env.EMOJI_ASSET_PATH ||
      DEFAULT_EMOJI_ASSET_PATH;
    return configured.endsWith("/") ? configured.slice(0, -1) : configured;
  }
  return DEFAULT_EMOJI_ASSET_PATH;
};

/**
 * Converts a hyphen-separated hexadecimal emoji code to its decimal representation
 * @param {string} emojiUnified - The unified emoji code in hexadecimal format (e.g., "1f600" or "1f1e6-1f1e8")
 * @returns {string} The decimal representation of the emoji code (e.g., "128512" or "127462-127464")
 * @example
 * convertHexEmojiToDecimal("1f600") // returns "128512"
 * convertHexEmojiToDecimal("1f1e6-1f1e8") // returns "127462-127464"
 * convertHexEmojiToDecimal("") // returns ""
 */
export const convertHexEmojiToDecimal = (emojiUnified: string): string => {
  if (!emojiUnified) return "";

  return emojiUnified
    .toString()
    .split("-")
    .map((e) => parseInt(e, 16))
    .join("-");
};

/**
 * Converts a hyphen-separated decimal emoji code back to its hexadecimal representation
 * @param {string} emoji - The emoji code in decimal format (e.g., "128512" or "127462-127464")
 * @returns {string} The hexadecimal representation of the emoji code (e.g., "1f600" or "1f1e6-1f1e8")
 * @example
 * emojiCodeToUnicode("128512") // returns "1f600"
 * emojiCodeToUnicode("127462-127464") // returns "1f1e6-1f1e8"
 * emojiCodeToUnicode("") // returns ""
 */
export const emojiCodeToUnicode = (emoji: string): string => {
  if (!emoji) return "";

  // convert emoji code to unicode
  const uniCodeEmoji = emoji
    .toString()
    .split("-")
    .map((emojiSegment) => {
      const decimal = parseInt(emojiSegment, 10);
      return formatUnicodeSegment(decimal);
    })
    .filter(Boolean)
    .join("-");

  return uniCodeEmoji;
};

/**
 * Converts an emoji string (e.g. 😀) to its decimal code representation
 */
export const emojiStringToDecimal = (emoji: string): string => {
  if (!emoji) return "";
  return Array.from(emoji)
    .map((char) => {
      const codePoint = char.codePointAt(0);
      return codePoint !== undefined ? codePoint.toString(10) : "";
    })
    .filter(Boolean)
    .join("-");
};

/**
 * Converts an emoji string (e.g. 😀) to a hyphen separated unicode string (e.g. 1f600)
 */
export const emojiStringToUnicode = (emoji: string): string => {
  if (!emoji) return "";
  return Array.from(emoji)
    .map((char) => {
      const codePoint = char.codePointAt(0);
      return codePoint !== undefined ? formatUnicodeSegment(codePoint) : "";
    })
    .filter(Boolean)
    .join("-");
};

const buildEmojiImageUrl = (unicode: string): string => {
  if (!unicode) return "";
  return `${getEmojiAssetBasePath()}/${unicode.toLowerCase()}.png`;
};

export const getEmojiImageUrlFromDecimal = (emoji: string): string => buildEmojiImageUrl(emojiCodeToUnicode(emoji));

export const getEmojiImageUrlFromUnicode = (unicode: string): string => buildEmojiImageUrl(unicode);

export const getEmojiImageUrlFromEmoji = (emoji: string): string => buildEmojiImageUrl(emojiStringToUnicode(emoji));

export const getEmojiAssetPath = (): string => getEmojiAssetBasePath();

/**
 * Groups reactions by a specified key
 * @param {any[]} reactions - Array of reaction objects
 * @param {string} key - Key to group reactions by
 * @returns {Object} Object with reactions grouped by the specified key
 */
export const groupReactions: (reactions: any[], key: string) => { [key: string]: any[] } = (
  reactions: any,
  key: string
) => {
  if (!Array.isArray(reactions)) {
    console.error("Expected an array of reactions, but got:", reactions);
    return {};
  }

  const groupedReactions = reactions.reduce(
    (acc: any, reaction: any) => {
      if (!reaction || typeof reaction !== "object" || !Object.prototype.hasOwnProperty.call(reaction, key)) {
        console.warn("Skipping undefined reaction or missing key:", reaction);
        return acc; // Skip undefined reactions or those without the specified key
      }

      if (!acc[reaction[key]]) {
        acc[reaction[key]] = [];
      }
      acc[reaction[key]].push(reaction);
      return acc;
    },
    {} as { [key: string]: any[] }
  );

  return groupedReactions;
};

/**
 * Returns a random emoji code from the RANDOM_EMOJI_CODES array
 * @returns {string} A random emoji code
 */
export const getRandomEmoji = (): string => RANDOM_EMOJI_CODES[Math.floor(Math.random() * RANDOM_EMOJI_CODES.length)];
