import type { HocuspocusProvider } from "@hocuspocus/provider";
import type { AnyExtension } from "@tiptap/core";
import { SlashCommands, WorkItemEmbedExtension } from "@/extensions";
import { CustomReadOnlyFileExtension } from "@/extensions/custom-file/read-only-custom-file";
// types
import type { IEditorProps, TExtensions, TUserDetails } from "@/types";

export type TDocumentEditorAdditionalExtensionsProps = Pick<
  IEditorProps,
  "disabledExtensions" | "flaggedExtensions" | "fileHandler" | "extendedEditorProps"
> & {
  isEditable: boolean;
  provider?: HocuspocusProvider;
  userDetails: TUserDetails;
};

export type TDocumentEditorAdditionalExtensionsRegistry = {
  isEnabled: (disabledExtensions: TExtensions[], flaggedExtensions: TExtensions[], isEditable: boolean) => boolean;
  getExtension: (props: TDocumentEditorAdditionalExtensionsProps) => AnyExtension | undefined;
};

const extensionRegistry: TDocumentEditorAdditionalExtensionsRegistry[] = [
  {
    isEnabled: (disabledExtensions) => !disabledExtensions.includes("slash-commands"),
    getExtension: ({ disabledExtensions, flaggedExtensions, extendedEditorProps }) =>
      SlashCommands({ disabledExtensions, flaggedExtensions, extendedEditorProps }),
  },
];

export const DocumentEditorAdditionalExtensions = (props: TDocumentEditorAdditionalExtensionsProps) => {
  const { disabledExtensions, extendedEditorProps, flaggedExtensions } = props;

  const documentExtensions = extensionRegistry
    .filter((config) => config.isEnabled(disabledExtensions, flaggedExtensions, props.isEditable))
    .map((config) => config.getExtension(props))
    .filter((extension): extension is AnyExtension => extension !== undefined);

  const issueEmbedConfig = extendedEditorProps?.embeds?.issue;

  if (!disabledExtensions.includes("issue-embed") && issueEmbedConfig?.widgetCallback) {
    documentExtensions.push(
      WorkItemEmbedExtension({
        widgetCallback: issueEmbedConfig.widgetCallback,
      })
    );
  }

  return documentExtensions;
};
