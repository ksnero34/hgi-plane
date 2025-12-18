import type { HocuspocusProvider } from "@hocuspocus/provider";
import type { Extensions } from "@tiptap/core";
import { CharacterCount } from "@tiptap/extension-character-count";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { TextStyle } from "@tiptap/extension-text-style";
import { Underline } from "@tiptap/extension-underline";
import { Markdown } from "tiptap-markdown";
// extensions
import {
  CustomCalloutExtension,
  CustomCodeBlockExtension,
  CustomCodeInlineExtension,
  CustomColorExtension,
  CustomHorizontalRule,
  CustomKeymap,
  CustomLinkExtension,
  CustomMentionExtension,
  CustomQuoteExtension,
  CustomTextAlignExtension,
  CustomTypographyExtension,
  ImageExtension,
  ListKeymap,
  Table,
  TableCell,
  TableHeader,
  TableRow,
  CustomFileExtension,
  CustomReadOnlyFileExtension,
  
  UtilityExtension
} from "@/extensions";
import type {FileHandler} from "@/extensions";
// plane editor extensions
import { CoreEditorAdditionalExtensions } from "@/plane-editor/extensions";
// types
import type { IEditorProps } from "@/types";
// local imports
import { CustomImageExtension } from "./custom-image/extension";
import { EmojiExtension } from "./emoji/extension";
import { CustomPlaceholderExtension } from "./placeholder";
import { CustomStarterKitExtension } from "./starter-kit";
import { ExternalEmbedExtension } from "./external-embed";
import { UniqueID } from "./unique-id/extension";

type TArguments = Pick<
  IEditorProps,
  | "disabledExtensions"
  | "flaggedExtensions"
  | "fileHandler"
  | "getEditorMetaData"
  | "isTouchDevice"
  | "mentionHandler"
  | "placeholder"
  | "showPlaceholderOnEmpty"
  | "tabIndex"
  | "extendedEditorProps"
> & {
  enableHistory: boolean;
  editable: boolean;
  provider: HocuspocusProvider | undefined;
};

export const CoreEditorExtensions = (args: TArguments): Extensions => {
  const {
    disabledExtensions,
    enableHistory,
    fileHandler,
    flaggedExtensions,
    getEditorMetaData,
    isTouchDevice = false,
    mentionHandler,
    placeholder,
    showPlaceholderOnEmpty,
    tabIndex,
    editable,
    extendedEditorProps,
    provider,
  } = args;

  const extensions = [
    CustomStarterKitExtension({
      enableHistory,
    }),
    EmojiExtension,
    CustomQuoteExtension,
    CustomHorizontalRule,
    CustomKeymap,
    ListKeymap({ tabIndex }),
    CustomLinkExtension,
    CustomTypographyExtension,
    Underline,
    // ImageExtension(fileHandler).configure({
    //   HTMLAttributes: {
    //     class: "rounded-md",
    //   },
    // }),
    // CustomImageExtension(fileHandler),
    ...(disabledExtensions.includes("file")
      ? []
      : [
          editable
            ? CustomFileExtension(
                {
                  upload: (file: File) => fileHandler.upload("", file),
                  delete: fileHandler.delete,
                  restore: fileHandler.restore,
                  validateFile: async (file: File) => {
                    // 파일 크기 검사
                    if (fileHandler.validation?.maxFileSize && file.size > fileHandler.validation.maxFileSize) {
                      return false;
                    }
                    return true;
                  },
                  getAssetSrc: fileHandler.getAssetSrc,
                  getAssetDownloadSrc: fileHandler.getAssetDownloadSrc,
                },
                "",
                ""
              )
            : CustomReadOnlyFileExtension({
                getAssetSrc: fileHandler.getAssetSrc,
                getAssetDownloadSrc: fileHandler.getAssetDownloadSrc,
              }),
        ]),
    TextStyle,
    TaskList.configure({
      HTMLAttributes: {
        class: "not-prose pl-2 space-y-2",
      },
    }),
    TaskItem.configure({
      HTMLAttributes: {
        class: "relative",
      },
      nested: true,
    }),
    CustomCodeBlockExtension,
    CustomCodeInlineExtension,
    Markdown.configure({
      html: true,
      transformCopiedText: false,
      transformPastedText: true,
      breaks: true,
    }),
    Table,
    TableHeader,
    TableCell,
    TableRow,
    CustomMentionExtension(mentionHandler),
    CustomPlaceholderExtension({ placeholder, showPlaceholderOnEmpty }),
    CharacterCount,
    CustomColorExtension,
    CustomTextAlignExtension,
    CustomCalloutExtension,
    UtilityExtension({
      disabledExtensions,
      flaggedExtensions,
      fileHandler,
      getEditorMetaData,
      isEditable: editable,
      isTouchDevice,
    }),
    ...CoreEditorAdditionalExtensions({
      disabledExtensions,
      flaggedExtensions,
      fileHandler,
      extendedEditorProps,
    }),
    UniqueID.configure({
      provider,
    }),
  ];

  if (!disabledExtensions.includes("external-embed")) {
    extensions.push(ExternalEmbedExtension());
  }

  if (!disabledExtensions.includes("image")) {
    extensions.push(
      ImageExtension({
        fileHandler,
      }),
      CustomImageExtension({
        fileHandler,
        isEditable: editable,
      })
    );
  }

  return extensions;
};
