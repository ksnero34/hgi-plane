import type { Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
// constants
import { ACCEPTED_ATTACHMENT_MIME_TYPES, ACCEPTED_IMAGE_MIME_TYPES } from "@/constants/config";
// types
import type { TEditorCommands, TExtensions } from "@/types";

type Props = {
  disabledExtensions?: TExtensions[];
  flaggedExtensions?: TExtensions[];
  editor: Editor;
};

export const DropHandlerPlugin = (props: Props): Plugin => {
  const { disabledExtensions, flaggedExtensions, editor } = props;

  return new Plugin({
    key: new PluginKey("drop-handler-plugin"),
    props: {
      handlePaste: (view, event) => {
        if (
          editor.isEditable &&
          event.clipboardData &&
          event.clipboardData.files &&
          event.clipboardData.files.length > 0
        ) {
          event.preventDefault();
          const files = Array.from(event.clipboardData.files);
          const acceptedFiles = files.filter(
            (f) => ACCEPTED_IMAGE_MIME_TYPES.includes(f.type) || ACCEPTED_ATTACHMENT_MIME_TYPES.includes(f.type)
          );

          // 엑셀 데이터 처리 - 테이블이 있는 HTML 확인
          const types = Array.from(event.clipboardData?.types || []);
          const hasHtml = types.indexOf("text/html") !== -1;

          if (hasHtml && event.clipboardData) {
            const html = event.clipboardData.getData("text/html");
            const hasTable = html.indexOf("<table") !== -1 && html.indexOf("<td") !== -1;

            // CSV나 TSV 형식인지도 확인
            const isSpreadsheetData =
              hasTable ||
              html.indexOf("LibreOffice") !== -1 ||
              html.indexOf("Microsoft Excel") !== -1 ||
              html.indexOf("Google Sheets") !== -1 ||
              html.indexOf("data-sheets-value") !== -1;

            if (isSpreadsheetData) {
              event.preventDefault();

              try {
                // HTML을 파싱하여 테이블 데이터 추출
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, "text/html");
                const tables = doc.querySelectorAll("table");

                if (tables.length > 0) {
                  const table = tables[0];
                  const rows = Array.from(table.rows);
                  const rowCount = rows.length;
                  const colCount = rows[0]?.cells.length || 1;

                  // HTML 테이블로 변환하여 삽입
                  let tableHTML = "<table><tbody>";
                  for (let i = 0; i < rowCount; i++) {
                    tableHTML += "<tr>";
                    for (let j = 0; j < colCount; j++) {
                      const cell = rows[i]?.cells[j];
                      if (!cell) continue;

                      const content = cell.textContent || "";
                      const colspan = parseInt(cell.getAttribute("colspan") || "1", 10);
                      const rowspan = parseInt(cell.getAttribute("rowspan") || "1", 10);

                      // 병합된 셀인 경우 colspan과 rowspan 속성 추가
                      tableHTML += `<td${colspan > 1 ? ` colspan="${colspan}"` : ""}${rowspan > 1 ? ` rowspan="${rowspan}"` : ""}>${content}</td>`;

                      // colspan만큼 j 증가 (다음 셀로 이동)
                      j += colspan - 1;
                    }
                    tableHTML += "</tr>";
                  }
                  tableHTML += "</tbody></table>";

                  // HTML을 직접 삽입
                  editor.commands.insertContent(tableHTML);

                  // 테이블로 처리했으므로 이후 처리 중단
                  return true;
                }
              } catch (error) {
                // 오류가 발생해도 이미지 처리를 시도하지 않고 반환
                return false;
              }
            }
          }

          if (acceptedFiles.length) {
            const pos = view.state.selection.from;
            insertFilesSafely({
              disabledExtensions,
              flaggedExtensions,
              editor,
              files: acceptedFiles,
              initialPos: pos,
              event: "drop",
            });
          }
          return true;
        }
        return false;
      },
      handleDrop: (view, event, _slice, moved) => {
        if (
          editor.isEditable &&
          !moved &&
          event.dataTransfer &&
          event.dataTransfer.files &&
          event.dataTransfer.files.length > 0
        ) {
          event.preventDefault();
          const files = Array.from(event.dataTransfer.files);
          const acceptedFiles = files.filter(
            (f) => ACCEPTED_IMAGE_MIME_TYPES.includes(f.type) || ACCEPTED_ATTACHMENT_MIME_TYPES.includes(f.type)
          );

          if (acceptedFiles.length) {
            const coordinates = view.posAtCoords({
              left: event.clientX,
              top: event.clientY,
            });

            if (coordinates) {
              const pos = coordinates.pos;
              insertFilesSafely({
                disabledExtensions,
                editor,
                files: acceptedFiles,
                initialPos: pos,
                event: "drop",
              });
            }
            return true;
          }
        }
        return false;
      },
    },
  });
};

type InsertFilesSafelyArgs = {
  disabledExtensions?: TExtensions[];
  flaggedExtensions?: TExtensions[];
  editor: Editor;
  event: "insert" | "drop";
  files: File[];
  initialPos: number;
  type?: Extract<TEditorCommands, "attachment" | "image">;
};

export const insertFilesSafely = async (args: InsertFilesSafelyArgs) => {
  const { disabledExtensions, editor, event, files, initialPos, type } = args;
  let pos = initialPos;

  for (const file of files) {
    // safe insertion
    const docSize = editor.state.doc.content.size;
    pos = Math.min(pos, docSize);

    let fileType: "image" | "attachment" | null = null;

    try {
      if (type) {
        if (["image", "attachment"].includes(type)) fileType = type;
        else throw new Error("Wrong file type passed");
      } else {
        if (ACCEPTED_IMAGE_MIME_TYPES.includes(file.type)) fileType = "image";
        else if (ACCEPTED_ATTACHMENT_MIME_TYPES.includes(file.type)) fileType = "attachment";
      }
      // insert file depending on the type at the current position
      if (fileType === "image" && !disabledExtensions?.includes("image")) {
        editor.commands.insertImageComponent({
          file,
          pos,
          event,
        });
      } else if (fileType === "attachment") {
      }
    } catch (error) {
      console.error(`Error while ${event}ing file:`, error);
    }

    // Move to the next position
    pos += 1;
  }
};
