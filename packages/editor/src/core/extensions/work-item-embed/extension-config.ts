import { mergeAttributes, Node } from "@tiptap/core";
// constants
import { CORE_EXTENSIONS } from "@/constants/extension";

export const WorkItemEmbedExtensionConfig = Node.create({
  name: CORE_EXTENSIONS.WORK_ITEM_EMBED,
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      entity_identifier: {
        default: undefined,
      },
      project_identifier: {
        default: undefined,
      },
      workspace_identifier: {
        default: undefined,
      },
      id: {
        default: undefined,
      },
      entity_name: {
        default: undefined,
      },
      project_slug: {
        default: undefined,
      },
      issue_title: {
        default: undefined,
      },
      issue_sequence_id: {
        default: undefined,
      },
      issue_state_id: {
        default: undefined,
      },
      issue_priority: {
        default: undefined,
      },
      issue_state_name: {
        default: undefined,
      },
      issue_state_group: {
        default: undefined,
      },
      issue_state_color: {
        default: undefined,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "issue-embed-component",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["issue-embed-component", mergeAttributes(HTMLAttributes)];
  },
});
