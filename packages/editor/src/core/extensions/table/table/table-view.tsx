import type { Editor, NodeViewProps } from "@tiptap/core";
import type { Node as ProseMirrorNode, ResolvedPos } from "@tiptap/pm/model";
import { CellSelection, TableMap, updateColumnsOnResize } from "@tiptap/pm/tables";
import type { Decoration, NodeView } from "@tiptap/pm/view";
import { h } from "jsx-dom-cjs";
import tippy from "tippy.js";
import type {Instance, Props} from "tippy.js";
import { CORE_EXTENSIONS } from "@/constants/extension";
import { icons } from "./icons";
import { isCellSelection } from "./utilities/helpers";

type ToolboxContext = {
  editor: Editor;
  triggerButton?: Element | null;
  controlsContainer?: HTMLElement | null;
  anchorPos?: number;
  headPos?: number;
};

type ToolboxItem = {
  label: string;
  icon: string;
  action: (args: ToolboxContext) => any;
};

type ContextMenuItem = ToolboxItem & {
  shouldDisplay?: (context: ToolboxContext & { selection: CellSelection | null }) => boolean;
  disabled?: (context: ToolboxContext & { selection: CellSelection | null }) => boolean;
};

export function updateColumns(
  node: ProseMirrorNode,
  colgroup: HTMLElement,
  table: HTMLElement,
  cellMinWidth: number,
  overrideCol?: number,
  overrideValue?: any
) {
  let totalWidth = 0;
  let fixedWidth = true;
  let nextDOM = colgroup.firstChild as HTMLElement;
  const row = node.firstChild;

  if (!row) return;

  for (let i = 0, col = 0; i < row.childCount; i += 1) {
    const { colspan, colWidth } = row.child(i).attrs;

    for (let j = 0; j < colspan; j += 1, col += 1) {
      const hasWidth = overrideCol === col ? overrideValue : colWidth && colWidth[j];
      const cssWidth = hasWidth ? `${hasWidth}px` : "";

      totalWidth += hasWidth || cellMinWidth;

      if (!hasWidth) {
        fixedWidth = false;
      }

      if (!nextDOM) {
        colgroup.appendChild(document.createElement("col")).style.width = cssWidth;
      } else {
        if (nextDOM.style.width !== cssWidth) {
          nextDOM.style.width = cssWidth;
        }

        nextDOM = nextDOM.nextSibling as HTMLElement;
      }
    }
  }

  while (nextDOM) {
    const after = nextDOM.nextSibling;

    nextDOM.parentNode?.removeChild(nextDOM);
    nextDOM = after as HTMLElement;
  }

  if (fixedWidth) {
    table.style.width = `${totalWidth}px`;
    table.style.minWidth = "";
  } else {
    table.style.width = "";
    table.style.minWidth = `${totalWidth}px`;
  }
}

const defaultTippyOptions: Partial<Props> = {
  allowHTML: true,
  arrow: false,
  trigger: "click",
  animation: "scale-subtle",
  theme: "light-border no-padding",
  interactive: true,
  hideOnClick: true,
  placement: "right",
};

const selectionToolbarOptions: Partial<Props> = {
  trigger: "manual",
  interactive: true,
  arrow: false,
  placement: "bottom",
  theme: "light-border no-padding",
};

function setCellsBackgroundColor(editor: Editor, color: { backgroundColor: string; textColor: string }) {
  return editor
    .chain()
    .focus()
    .updateAttributes(CORE_EXTENSIONS.TABLE_CELL, {
      background: color.backgroundColor,
      textColor: color.textColor,
    })
    .run();
}

function setTableRowBackgroundColor(editor: Editor, color: { backgroundColor: string; textColor: string }) {
  const { state, dispatch } = editor.view;
  const { selection } = state;
  if (!isCellSelection(selection)) {
    return false;
  }

  const hoveredCell = selection.$headCell || selection.$anchorCell;
  if (!hoveredCell) return false;

  let rowDepth = hoveredCell.depth;
  while (rowDepth > 0 && hoveredCell.node(rowDepth).type.name !== CORE_EXTENSIONS.TABLE_ROW) {
    rowDepth -= 1;
  }

  if (hoveredCell.node(rowDepth).type.name !== CORE_EXTENSIONS.TABLE_ROW) {
    return false;
  }

  const rowStartPos = hoveredCell.start(rowDepth);

  const tr = state.tr.setNodeMarkup(rowStartPos - 1, null, {
    ...hoveredCell.node(rowDepth).attrs,
    background: color.backgroundColor,
    textColor: color.textColor,
  });

  dispatch(tr);
  return true;
}

const columnsToolboxItems: ToolboxItem[] = [
  {
    label: "Toggle column header",
    icon: icons.toggleColumnHeader,
    action: ({ editor }) => editor.chain().focus().toggleHeaderColumn().run(),
  },
  {
    label: "Add column before",
    icon: icons.insertLeftTableIcon,
    action: ({ editor }) => editor.chain().focus().addColumnBefore().run(),
  },
  {
    label: "Add column after",
    icon: icons.insertRightTableIcon,
    action: ({ editor }) => editor.chain().focus().addColumnAfter().run(),
  },
  {
    label: "Pick color",
    icon: "",
    action: () => {},
  },
  {
    label: "Delete column",
    icon: icons.deleteColumn,
    action: ({ editor }) => editor.chain().focus().deleteColumn().run(),
  },
];

const rowsToolboxItems: ToolboxItem[] = [
  {
    label: "Toggle row header",
    icon: icons.toggleRowHeader,
    action: ({ editor }) => editor.chain().focus().toggleHeaderRow().run(),
  },
  {
    label: "Add row above",
    icon: icons.insertTopTableIcon,
    action: ({ editor }) => editor.chain().focus().addRowBefore().run(),
  },
  {
    label: "Add row below",
    icon: icons.insertBottomTableIcon,
    action: ({ editor }) => editor.chain().focus().addRowAfter().run(),
  },
  {
    label: "Pick color",
    icon: "",
    action: () => {},
  },
  {
    label: "Delete row",
    icon: icons.deleteRow,
    action: ({ editor }) => editor.chain().focus().deleteRow().run(),
  },
];

const selectionToolbarItems: ContextMenuItem[] = [
  {
    label: "Merge cells",
    icon: icons.insertLeftTableIcon,
    action: ({ editor }) => editor.chain().focus().mergeCells().run(),
    shouldDisplay: ({ selection, editor }) =>
      Boolean(selection && selection.ranges.length > 0 && editor.can().mergeCells()),
  },
  {
    label: "Unmerge cells",
    icon: icons.insertRightTableIcon,
    action: ({ editor }) => editor.chain().focus().splitCell().run(),
    shouldDisplay: ({ editor }) => editor.can().splitCell(),
  },
  {
    label: "Distribute columns",
    icon: icons.toggleColumnHeader,
    action: ({ editor }) => {
      const canDistribute = (editor.can() as any).distributeColumns?.();
      if (canDistribute) {
        (editor.chain().focus() as any).distributeColumns?.().run();
      }
    },
    shouldDisplay: ({ editor }) => (editor.can() as any).distributeColumns?.() ?? false,
  },
  {
    label: "Clear cell background",
    icon: icons.toggleRowHeader,
    action: ({ editor }) =>
      editor.chain().focus().updateAttributes(CORE_EXTENSIONS.TABLE_CELL, { background: null, textColor: null }).run(),
    shouldDisplay: ({ selection }) => Boolean(selection),
  },
];

function createSelectionToolbarContent(
  items: ContextMenuItem[],
  context: ToolboxContext & { selection: CellSelection | null }
) {
  return h(
    "div",
    {
      class:
        "rounded-md border-[0.5px] border-custom-border-300 bg-custom-background-100 py-1 text-xs shadow-custom-shadow-rg min-w-[10rem] whitespace-nowrap",
      "data-prevent-outside-click": "",
    } as any,
    items.map((item) =>
      h(
        "button",
        {
          class:
            "flex w-full items-center gap-2 px-2 py-1.5 text-left text-custom-text-200 hover:bg-custom-background-80",
          disabled: item.disabled ? item.disabled(context) : false,
          onClick: (event: Event) => {
            event.preventDefault();
            event.stopPropagation();
            item.action(context);
          },
        } as any,
        [
          h("span", { class: "h-3 w-3 flex-shrink-0", innerHTML: item.icon } as any),
          h("span", { class: "text-xs" } as any, item.label),
        ]
      )
    )
  );
}

function createToolbox({
  triggerButton,
  items,
  tippyOptions,
  onSelectColor,
  onClickItem,
  colors,
}: {
  triggerButton: Element | null;
  items: ToolboxItem[];
  tippyOptions: any;
  onClickItem: (item: ToolboxItem, event?: MouseEvent) => void;
  onSelectColor: (color: { backgroundColor: string; textColor: string }, event?: MouseEvent) => void;
  colors: { [key: string]: { backgroundColor: string; textColor: string; icon?: string } };
}): Instance<Props> {
  const toolbox = tippy(triggerButton ?? document.body, {
    content: h(
      "div",
      {
        class:
          "rounded-md border-[0.5px] border-custom-border-300 bg-custom-background-100 px-2 py-2.5 text-xs shadow-custom-shadow-rg min-w-[12rem] whitespace-nowrap",
        "data-prevent-outside-click": "",
      } as any,
      items.map((item) => {
        if (item.label === "Pick color") {
          return h("div", { class: "flex flex-col" } as any, [
            h("hr", { class: "my-2 border-custom-border-200" } as any),
            h("div", { class: "text-custom-text-200 text-sm" } as any, item.label),
            h(
              "div",
              { class: "grid grid-cols-6 gap-x-1 gap-y-2.5 mt-2" } as any,
              Object.entries(colors).map(([_, colorValue]) =>
                h("div", {
                  class: "grid place-items-center size-6 rounded cursor-pointer",
                  style: `background-color: ${colorValue.backgroundColor};color: ${colorValue.textColor || "inherit"};`,
                  innerHTML:
                    colorValue.icon ??
                    `<span class=\"text-md\" style=\"color: ${colorValue.textColor || colorValue.backgroundColor}\">A</span>`,
                  onClick: (event: MouseEvent) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onSelectColor(colorValue, event);
                  },
                } as any)
              )
            ),
            h("hr", { class: "my-2 border-custom-border-200" } as any),
          ]);
        }

        return h(
          "div",
          {
            class:
              "flex items-center gap-2 px-1 py-1.5 bg-custom-background-100 hover:bg-custom-background-80 text-sm text-custom-text-200 rounded cursor-pointer",
            onClick: (event: MouseEvent) => {
              event.preventDefault();
              event.stopPropagation();
              onClickItem(item, event);
            },
          } as any,
          [
            h("span", {
              class: "h-3 w-3 flex-shrink-0",
              innerHTML: item.icon,
            } as any),
            h("div", { class: "label" } as any, item.label),
          ]
        );
      })
    ),
    ...tippyOptions,
  });

  return Array.isArray(toolbox) ? toolbox[0] : toolbox;
}

const contextMenuItems: ContextMenuItem[] = [
  {
    label: "Insert column before",
    icon: icons.insertLeftTableIcon,
    action: ({ editor }) => editor.chain().focus().addColumnBefore().run(),
    shouldDisplay: ({ editor }) => editor.can().addColumnBefore?.() ?? false,
  },
  {
    label: "Insert column after",
    icon: icons.insertRightTableIcon,
    action: ({ editor }) => editor.chain().focus().addColumnAfter().run(),
    shouldDisplay: ({ editor }) => editor.can().addColumnAfter?.() ?? false,
  },
  {
    label: "Insert row above",
    icon: icons.insertTopTableIcon,
    action: ({ editor }) => editor.chain().focus().addRowBefore().run(),
    shouldDisplay: ({ editor }) => editor.can().addRowBefore?.() ?? false,
  },
  {
    label: "Insert row below",
    icon: icons.insertBottomTableIcon,
    action: ({ editor }) => editor.chain().focus().addRowAfter().run(),
    shouldDisplay: ({ editor }) => editor.can().addRowAfter?.() ?? false,
  },
  {
    label: "Delete row",
    icon: icons.deleteRow,
    action: ({ editor }) => editor.chain().focus().deleteRow().run(),
    shouldDisplay: ({ editor }) => editor.can().deleteRow(),
  },
  {
    label: "Delete column",
    icon: icons.deleteColumn,
    action: ({ editor }) => editor.chain().focus().deleteColumn().run(),
    shouldDisplay: ({ editor }) => editor.can().deleteColumn(),
  },
  {
    label: "Merge cells",
    icon: icons.insertLeftTableIcon,
    action: ({ editor }) => editor.chain().focus().mergeCells().run(),
    shouldDisplay: ({ editor, selection }) => Boolean(selection && editor.can().mergeCells()),
  },
  {
    label: "Split cell",
    icon: icons.insertRightTableIcon,
    action: ({ editor }) => editor.chain().focus().splitCell().run(),
    shouldDisplay: ({ editor }) => editor.can().splitCell(),
  },
];

function createContextMenu(content: HTMLElement, appendTo: () => HTMLElement): Instance<Props> {
  content.setAttribute("data-prevent-outside-click", "");
  return tippy(document.body, {
    content,
    trigger: "manual",
    placement: "right-start",
    interactive: true,
    theme: "light-border no-padding",
    appendTo,
  });
}

export class TableView implements NodeView {
  node: ProseMirrorNode;
  cellMinWidth: number;
  decorations: readonly Decoration[];
  editor: Editor;
  getPos: NodeViewProps["getPos"];
  hoveredCell: ResolvedPos | null = null;
  map: TableMap;
  root: HTMLElement;
  table: HTMLTableElement;
  colgroup: HTMLTableColElement;
  tbody: HTMLElement;
  rowsControl?: HTMLElement | null;
  columnsControl?: HTMLElement | null;
  columnsToolbox?: Instance<Props>;
  rowsToolbox?: Instance<Props>;
  cellSelectionToolbar?: Instance<Props>;
  controls?: HTMLElement;
  contextMenu?: Instance<Props>;
  selectionUpdateHandler?: () => void;
  currentToolbarItemsKey: string | null = null;
  lastSelectionStateKey: string | null = null;
  editorContainer?: HTMLElement | null;

  get dom() {
    return this.root;
  }

  get contentDOM() {
    return this.tbody;
  }

  constructor(
    node: ProseMirrorNode,
    cellMinWidth: number,
    decorations: readonly Decoration[],
    editor: Editor,
    getPos: NodeViewProps["getPos"]
  ) {
    this.node = node;
    this.cellMinWidth = cellMinWidth;
    this.decorations = decorations;
    this.editor = editor;
    this.getPos = getPos;
    this.hoveredCell = null;
    this.map = TableMap.get(node);
    this.editorContainer = this.editor.view.dom.closest(".editor-container");

    if (editor.isEditable) {
      this.rowsControl = h(
        "div",
        { class: "rows-control" },
        h("div", {
          class: "rows-control-div",
          onClick: () => this.selectRow(),
        })
      );

      this.columnsControl = h(
        "div",
        { class: "columns-control" },
        h("div", {
          class: "columns-control-div",
          onClick: () => this.selectColumn(),
        })
      );

      this.controls = h(
        "div",
        { class: "table-controls", contentEditable: "false" },
        this.rowsControl,
        this.columnsControl
      );
      const columnColors = {
        Blue: { backgroundColor: "#D9E4FF", textColor: "#171717" },
        Orange: { backgroundColor: "#FFEDD5", textColor: "#171717" },
        Grey: { backgroundColor: "#F1F1F1", textColor: "#171717" },
        Yellow: { backgroundColor: "#FEF3C7", textColor: "#171717" },
        Green: { backgroundColor: "#DCFCE7", textColor: "#171717" },
        Red: { backgroundColor: "#FFDDDD", textColor: "#171717" },
        Pink: { backgroundColor: "#FFE8FA", textColor: "#171717" },
        Purple: { backgroundColor: "#E8DAFB", textColor: "#171717" },
        None: {
          backgroundColor: "none",
          textColor: "none",
          icon: `<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"gray\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-ban\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"m4.9 4.9 14.2 14.2\"/></svg>`,
        },
      };

      this.columnsToolbox = createToolbox({
        triggerButton: this.columnsControl.querySelector(".columns-control-div"),
        items: columnsToolboxItems,
        colors: columnColors,
        onSelectColor: (color) => setCellsBackgroundColor(this.editor, color),
        tippyOptions: {
          ...defaultTippyOptions,
          appendTo: this.controls,
        },
        onClickItem: (item) => {
          item.action({
            editor: this.editor,
            triggerButton: this.columnsControl?.firstElementChild ?? undefined,
            controlsContainer: this.controls,
          });
          this.columnsToolbox?.hide();
        },
      });

      this.rowsToolbox = createToolbox({
        triggerButton: this.rowsControl?.firstElementChild ?? null,
        items: rowsToolboxItems,
        colors: columnColors,
        tippyOptions: {
          ...defaultTippyOptions,
          appendTo: this.controls,
        },
        onSelectColor: (color) => setTableRowBackgroundColor(editor, color),
        onClickItem: (item) => {
          item.action({
            editor: this.editor,
            triggerButton: this.rowsControl?.firstElementChild ?? undefined,
            controlsContainer: this.controls,
          });
          this.rowsToolbox?.hide();
        },
      });

      this.cellSelectionToolbar = tippy(document.body, {
        ...(selectionToolbarOptions as Props),
        appendTo: () => this.getAppendToElement(),
      });
      this.contextMenu = createContextMenu(
        createSelectionToolbarContent(contextMenuItems, {
          editor,
          selection: null,
        }),
        () => this.getAppendToElement()
      );

      this.selectionUpdateHandler = () => this.updateSelectionToolbar();
      this.editor.on("selectionUpdate", this.selectionUpdateHandler);
    }

    this.colgroup = h(
      "colgroup",
      null,
      Array.from({ length: this.map.width }, () => 1).map(() => h("col"))
    );
    this.tbody = h("tbody");
    this.table = h("table", null, this.colgroup, this.tbody);

    this.root = h(
      "div",
      {
        class: "table-wrapper editor-full-width-block horizontal-scrollbar scrollbar-sm controls--disabled",
      },
      this.controls,
      this.table
    );

    if (this.contextMenu) {
      this.table.addEventListener("contextmenu", this.handleContextMenu);
      this.table.addEventListener("click", this.handleTableClick);
    }

    this.render();
  }

  update(node: ProseMirrorNode, decorations: readonly Decoration[]) {
    if (node.type !== this.node.type) {
      return false;
    }

    this.node = node;
    this.decorations = [...decorations];
    this.map = TableMap.get(this.node);

    if (this.editor.isEditable) {
      this.updateControls();
      this.updateSelectionToolbar();
    }

    this.render();

    return true;
  }

  render() {
    if (this.colgroup.children.length !== this.map.width) {
      const cols = Array.from({ length: this.map.width }, () => 1).map(() => h("col"));
      this.colgroup.replaceChildren(...cols);
    }

    updateColumnsOnResize(this.node, this.colgroup, this.table, this.cellMinWidth);
  }

  ignoreMutation() {
    return true;
  }

  updateControls() {
    const { hoveredTable: table, hoveredCell: cell } = Object.values(this.decorations).reduce(
      (acc, curr) => {
        if (curr.spec.hoveredCell !== undefined) {
          acc["hoveredCell"] = curr.spec.hoveredCell;
        }

        if (curr.spec.hoveredTable !== undefined) {
          acc["hoveredTable"] = curr.spec.hoveredTable;
        }
        return acc;
      },
      {} as Record<string, HTMLElement>
    ) as any;

    if (table === undefined || cell === undefined) {
      return this.root.classList.add("controls--disabled");
    }

    this.root.classList.remove("controls--disabled");
    this.hoveredCell = cell;

    const cellDom = this.editor.view.nodeDOM(cell.pos) as HTMLElement;

    if (!this.table || !cellDom) {
      return;
    }

    const tableRect = this.table?.getBoundingClientRect();
    const cellRect = cellDom?.getBoundingClientRect();

    if (this.columnsControl) {
      this.columnsControl.style.left = `${cellRect.left - tableRect.left - this.table.parentElement!.scrollLeft}px`;
      this.columnsControl.style.width = `${cellRect.width}px`;
    }
    if (this.rowsControl) {
      this.rowsControl.style.top = `${cellRect.top - tableRect.top}px`;
      this.rowsControl.style.height = `${cellRect.height}px`;
    }
  }

  private getCellSelection(): CellSelection | null {
    const { selection } = this.editor.state;
    if (selection instanceof CellSelection) {
      return selection;
    }
    return null;
  }

  private updateSelectionToolbar() {
    if (!this.cellSelectionToolbar) return;

    const selection = this.getCellSelection();
    if (!selection) {
      this.currentToolbarItemsKey = null;
      this.cellSelectionToolbar.hide();
      return;
    }

    const toolbarItems = selectionToolbarItems.filter((item) =>
      item.shouldDisplay ? item.shouldDisplay({ editor: this.editor, selection }) : true
    );

    const toolbarKey = toolbarItems.map((item) => item.label).join("|");

    if (!toolbarItems.length) {
      this.currentToolbarItemsKey = null;
      this.cellSelectionToolbar.hide();
      return;
    }

    const { $headCell } = selection;
    if (!$headCell) {
      this.cellSelectionToolbar.hide();
      return;
    }

    const coords = this.editor.view.coordsAtPos($headCell.pos);

    if (this.currentToolbarItemsKey !== toolbarKey) {
      this.cellSelectionToolbar.setContent(
        createSelectionToolbarContent(toolbarItems, {
          editor: this.editor,
          selection,
        })
      );
      this.currentToolbarItemsKey = toolbarKey;
    }

    this.cellSelectionToolbar.setProps({
      getReferenceClientRect: () =>
        ({
          width: 0,
          height: 0,
          top: coords.bottom + 4,
          bottom: coords.bottom + 4,
          left: coords.left,
          right: coords.left,
          x: coords.left,
          y: coords.bottom + 4,
          toJSON: () => ({}),
        }) as DOMRect,
    });

    this.cellSelectionToolbar.show();
  }

  private handleContextMenu = (event: MouseEvent) => {
    if (!this.contextMenu || !this.editor.isEditable) return;
    event.preventDefault();

    const coords = { left: event.clientX, top: event.clientY };
    const pos = this.editor.view.posAtCoords(coords);
    if (!pos) return;

    const $pos = this.editor.state.doc.resolve(pos.pos);
    const offset = $pos.pos - (this.getPos() + 1);
    if (offset < 0 || offset >= this.map.map.length) return;

    const cellStart = this.map.map[offset] + (this.getPos() + 1);
    const cellSelection = CellSelection.create(this.editor.state.doc, cellStart, cellStart);
    const tr = this.editor.state.tr.setSelection(cellSelection);
    this.editor.view.dispatch(tr);
    this.updateSelectionToolbar();

    const selection = this.getCellSelection();

    const content = createSelectionToolbarContent(
      contextMenuItems.filter((item) =>
        item.shouldDisplay ? item.shouldDisplay({ editor: this.editor, selection }) : true
      ),
      {
        editor: this.editor,
        selection,
      }
    );

    this.contextMenu.setContent(content);
    this.contextMenu.setProps({
      getReferenceClientRect: () =>
        ({
          width: 0,
          height: 0,
          top: event.clientY,
          bottom: event.clientY,
          left: event.clientX,
          right: event.clientX,
          x: event.clientX,
          y: event.clientY,
          toJSON: () => ({}),
        }) as DOMRect,
    });
    this.contextMenu.show();
  };

  private handleTableClick = () => {
    this.contextMenu?.hide();
  };

  private getAppendToElement(): HTMLElement {
    return this.editorContainer ?? document.body;
  }

  selectColumn() {
    if (!this.hoveredCell) return;

    const colIndex = this.map.colCount(this.hoveredCell.pos - (this.getPos() + 1));
    const anchorCellPos = this.hoveredCell.pos;
    const headCellPos = this.map.map[colIndex + this.map.width * (this.map.height - 1)] + (this.getPos() + 1);

    const cellSelection = CellSelection.create(this.editor.view.state.doc, anchorCellPos, headCellPos);
    this.editor.view.dispatch(this.editor.state.tr.setSelection(cellSelection));
    this.updateSelectionToolbar();
  }

  selectRow() {
    if (!this.hoveredCell) return;

    const anchorCellPos = this.hoveredCell.pos;
    const anchorCellIndex = this.map.map.indexOf(anchorCellPos - (this.getPos() + 1));
    const headCellPos = this.map.map[anchorCellIndex + (this.map.width - 1)] + (this.getPos() + 1);

    const cellSelection = CellSelection.create(this.editor.state.doc, anchorCellPos, headCellPos);
    this.editor.view.dispatch(this.editor.view.state.tr.setSelection(cellSelection));
    this.updateSelectionToolbar();
  }

  destroy() {
    this.table?.removeEventListener("contextmenu", this.handleContextMenu);
    this.table?.removeEventListener("click", this.handleTableClick);

    if (this.selectionUpdateHandler) {
      this.editor.off("selectionUpdate", this.selectionUpdateHandler);
    }

    this.cellSelectionToolbar?.destroy();
    this.contextMenu?.destroy();
    this.columnsToolbox?.destroy();
    this.rowsToolbox?.destroy();
  }
}
