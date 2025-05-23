import { Extension, Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { EditorView } from "@tiptap/pm/view";

export const DropHandlerExtension = Extension.create({
  name: "dropHandler",
  priority: 1000,

  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: new PluginKey("drop-handler-plugin"),
        props: {
          handlePaste: (view: EditorView, event: ClipboardEvent) => {
            if (!editor.isEditable) return false;

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
                    let tableHTML = '<table><tbody>';
                    for (let i = 0; i < rowCount; i++) {
                      tableHTML += '<tr>';
                      for (let j = 0; j < colCount; j++) {
                        const cell = rows[i]?.cells[j];
                        if (!cell) continue;
                        
                        const content = cell.textContent || '';
                        const colspan = parseInt(cell.getAttribute('colspan') || '1', 10);
                        const rowspan = parseInt(cell.getAttribute('rowspan') || '1', 10);
                        
                        // 병합된 셀인 경우 colspan과 rowspan 속성 추가
                        tableHTML += `<td${colspan > 1 ? ` colspan="${colspan}"` : ''}${rowspan > 1 ? ` rowspan="${rowspan}"` : ''}>${content}</td>`;
                        
                        // colspan만큼 j 증가 (다음 셀로 이동)
                        j += (colspan - 1);
                      }
                      tableHTML += '</tr>';
                    }
                    tableHTML += '</tbody></table>';
                    
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
            
            // 기존 이미지 처리 로직 - 테이블 처리가 되지 않은 경우에만 실행
            if (
              event.clipboardData &&
              event.clipboardData.files &&
              event.clipboardData.files.length > 0
            ) {
              const files = Array.from(event.clipboardData.files);
              const imageFiles = files.filter((file) => file.type.startsWith("image"));

              if (imageFiles.length > 0) {
                event.preventDefault();
                const pos = view.state.selection.from;
                insertImagesSafely({ editor, files: imageFiles, initialPos: pos, event: "drop" });
                return true;
              }
            }
            return false;
          },
          handleDrop: (view: EditorView, event: DragEvent, _slice: any, moved: boolean) => {
            if (
              editor.isEditable &&
              !moved &&
              event.dataTransfer &&
              event.dataTransfer.files &&
              event.dataTransfer.files.length > 0
            ) {
              event.preventDefault();
              const files = Array.from(event.dataTransfer.files);
              const imageFiles = files.filter((file) => file.type.startsWith("image"));

              if (imageFiles.length > 0) {
                const coordinates = view.posAtCoords({
                  left: event.clientX,
                  top: event.clientY,
                });

                if (coordinates) {
                  const pos = coordinates.pos;
                  insertImagesSafely({ editor, files: imageFiles, initialPos: pos, event: "drop" });
                }
                return true;
              }
            }
            return false;
          },
        },
      }),
    ];
  },
});
export const insertImagesSafely = async ({
  editor,
  files,
  initialPos,
  event,
}: {
  editor: Editor;
  files: File[];
  initialPos: number;
  event: "insert" | "drop";
}) => {
  let pos = initialPos;

  for (const file of files) {
    // safe insertion
    const docSize = editor.state.doc.content.size;
    pos = Math.min(pos, docSize);

    try {
      // Insert the image at the current position
      editor.commands.insertImageComponent({ file, pos, event });
    } catch (error) {
      console.error(`Error while ${event}ing image:`, error);
    }

    // Move to the next position
    pos += 1;
  }
};
