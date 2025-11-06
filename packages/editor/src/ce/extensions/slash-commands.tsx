import { Ticket } from "lucide-react";
// extensions
import type { TSlashCommandAdditionalOption } from "@/extensions";
// types
import type { IEditorProps, IEditorPropsExtended } from "@/types";

type Props = Pick<IEditorProps, "disabledExtensions" | "flaggedExtensions"> & {
  extendedEditorProps?: IEditorPropsExtended;
};

export const coreEditorAdditionalSlashCommandOptions = (props: Props): TSlashCommandAdditionalOption[] => {
  const { disabledExtensions, extendedEditorProps } = props;
  const options: TSlashCommandAdditionalOption[] = [];

  const issueEmbedConfig = extendedEditorProps?.embeds?.issue;

  if (!disabledExtensions?.includes("issue-embed") && issueEmbedConfig?.onInsertRequest) {
    options.push({
      commandKey: "issue-embed",
      key: "issue-embed",
      title: "Issue embed",
      description: "Attach an existing issue card.",
      searchTerms: ["issue", "task", "work item", "ticket"],
      icon: <Ticket className="size-3.5" />,
      command: ({ editor, range }) => issueEmbedConfig.onInsertRequest?.({ editor, range }),
      section: "general",
      pushAfter: "code",
    });
  }

  return options;
};
