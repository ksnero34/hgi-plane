import { useCallback } from "react";
// plane types
import type { TSearchEntities } from "@plane/types";
// helpers
import { getBase64Image, getEditorAssetSrc } from "@plane/utils";
import type { TCustomComponentsMetaData } from "@plane/utils";
// hooks
import { useMember } from "@/hooks/store/use-member";
// plane web hooks
import { useAdditionalEditorMention } from "@/plane-web/hooks/use-additional-editor-mention";

type TArgs = {
  projectId?: string;
  workspaceSlug: string;
};

export const useParseEditorContent = (args: TArgs) => {
  const { projectId, workspaceSlug } = args;
  // store hooks
  const { getUserDetails } = useMember();
  // parse additional content
  const { parseAdditionalEditorContent } = useAdditionalEditorMention({
    enableAdvancedMentions: true,
  });

  /**
   * @description function to replace all the custom components from the html component to make it pdf compatible
   * @param props
   * @returns {Promise<string>}
   */
  const replaceCustomComponentsFromHTMLContent = useCallback(
    async (props: { htmlContent: string; noAssets?: boolean }): Promise<string> => {
      const { htmlContent, noAssets = false } = props;
      // create a DOM parser
      const parser = new DOMParser();
      // parse the HTML string into a DOM document
      const doc = parser.parseFromString(htmlContent, "text/html");
      // replace all mention-component elements
      const mentionComponents = doc.querySelectorAll("mention-component");
      mentionComponents.forEach((component) => {
        // create a span element to replace the mention-component
        const span = doc.createElement("span");
        span.setAttribute("data-node-type", "mention-block");
        // get the user id from the component
        const id = component.getAttribute("entity_identifier") || "";
        const entityType = (component.getAttribute("entity_name") || "user_mention") as TSearchEntities;
        let textContent = "user";
        if (entityType === "user_mention") {
          const userDetails = getUserDetails(id);
          textContent = userDetails?.display_name ?? "";
        } else {
          const mentionDetails = parseAdditionalEditorContent({
            id,
            entityType,
          });
          if (mentionDetails) {
            textContent = mentionDetails.textContent;
          }
        }
        span.textContent = `@${textContent}`;
        // replace the mention-component with the span element
        component.replaceWith(span);
      });
      // handle code inside pre elements
      const preElements = doc.querySelectorAll("pre");
      preElements.forEach((preElement) => {
        const codeElement = preElement.querySelector("code");
        if (codeElement) {
          // create a div element with the required attributes for code blocks
          const div = doc.createElement("div");
          div.setAttribute("data-node-type", "code-block");
          div.setAttribute("class", "courier");
          // transfer the content from the code block
          div.innerHTML = codeElement.innerHTML.replace(/\n/g, "<br>") || "";
          // replace the pre element with the new div
          preElement.replaceWith(div);
        }
      });
      // handle inline code elements (not inside pre tags)
      const inlineCodeElements = doc.querySelectorAll("code");
      inlineCodeElements.forEach((codeElement) => {
        // check if the code element is inside a pre element
        if (!codeElement.closest("pre")) {
          // create a span element with the required attributes for inline code blocks
          const span = doc.createElement("span");
          span.setAttribute("data-node-type", "inline-code-block");
          span.setAttribute("class", "courier-bold");
          // transfer the code content
          span.textContent = codeElement.textContent || "";
          // replace the standalone code element with the new span
          codeElement.replaceWith(span);
        }
      });
      // handle image-component elements
      const imageComponents = doc.querySelectorAll("image-component");
      if (noAssets) {
        // if no assets is enabled, remove the image component elements
        imageComponents.forEach((component) => component.remove());
        // remove default img elements
        const imageElements = doc.querySelectorAll("img");
        imageElements.forEach((img) => img.remove());
      } else {
        // if no assets is not enabled, replace the image component elements with img elements
        imageComponents.forEach((component) => {
          // get the image src from the component
          const src = component.getAttribute("src") ?? "";
          // 원래 너비와 높이 속성값 가져오기
          const originalHeight = component.getAttribute("height") ?? "";
          const originalWidth = component.getAttribute("width") ?? "";

          // create an img element to replace the image-component
          const img = doc.createElement("img");
          img.src = src;

          // 이미지 크기 조정 - PDF에서 너무 커지지 않도록 제한
          // 퍼센트 값이면 최대 50%로 제한
          if (originalWidth.endsWith("%")) {
            const widthPercent = Math.min(parseInt(originalWidth), 50);
            img.style.width = `${widthPercent}%`;
          }
          // 픽셀 값이면 최대 500px로 제한
          else if (originalWidth.endsWith("px")) {
            const widthPx = Math.min(parseInt(originalWidth), 500);
            img.style.width = `${widthPx}px`;
          }
          // 값이 없으면 기본 40% 적용
          else {
            img.style.width = "40%";
          }

          // 높이는 자동으로 설정하여 비율 유지
          img.style.height = "auto";

          // replace the image-component with the img element
          component.replaceWith(img);
        });
      }
      // convert all images to base64
      const imgElements = doc.querySelectorAll("img");

      // 이미지 처리 로직 간소화
      await Promise.all(
        Array.from(imgElements).map(async (img) => {
          const src = img.getAttribute("src");
          if (!src) return;

          try {
            // 이미 data:image 형식이면 유지
            if (src.startsWith("data:")) return;

            // 이미지 URL 준비
            let fetchUrl = src;

            // 1. 상대 경로면 origin 추가
            if (src.startsWith("/")) {
              fetchUrl = `${window.location.origin}${src}`;
            }
            // 2. UUID 패턴 확인 (UUID만 있는 경우)
            else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(src)) {
              // URL에서 현재 경로 정보 추출
              const path = window.location.pathname.split("/");

              // 워크스페이스 슬러그와 프로젝트 ID 추출
              let workspaceSlug = "";
              let projectId = "";

              // 페이지 URL에서 정보 추출
              for (let i = 0; i < path.length; i++) {
                if ((path[i] === "workspaces" || path[i] === "workspace") && i + 1 < path.length) {
                  workspaceSlug = path[i + 1];
                } else if (path[1] && !workspaceSlug) {
                  // 첫 번째 경로 세그먼트를 워크스페이스로 사용
                  workspaceSlug = path[1];
                }

                if (path[i] === "projects" && i + 1 < path.length) {
                  projectId = path[i + 1];
                }
              }

              // API 경로 형식으로 구성
              if (workspaceSlug && projectId) {
                fetchUrl = `${window.location.origin}/api/assets/v2/workspaces/${workspaceSlug}/projects/${projectId}/${src}/`;
                // console.log("UUID를 API 경로로 변환:", src, "->", fetchUrl);
              } else {
                // console.warn("URL 구성에 필요한 정보를 찾을 수 없습니다", { workspaceSlug, projectId });
              }
            }
            // console.log("이미지 요청 URL:", fetchUrl);
            // 인증 세션을 포함하여 이미지 가져오기
            const response = await fetch(fetchUrl, {
              credentials: "include",
              mode: "cors",
              redirect: "follow",
            });

            if (!response.ok) {
              throw new Error(`이미지 가져오기 실패: ${response.status} ${response.statusText}`);
            }

            // 이미지를 blob으로 변환 후 base64로 인코딩
            const blob = await response.blob();
            const reader = new FileReader();
            const base64 = await new Promise<string>((resolve, reject) => {
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });

            // 이미지 소스 교체
            img.src = base64;

            // react-pdf에서 지원하지 않는 스타일 제거
            if (img.style.whiteSpace) img.style.whiteSpace = "";
          } catch (error) {
            console.error("이미지 변환 실패:", src, error);
            img.src =
              "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
          }
        })
      );
      // replace all checkbox elements
      const checkboxComponents = doc.querySelectorAll("input[type='checkbox']");
      checkboxComponents.forEach((component) => {
        // get the checked status from the element
        const checked = component.getAttribute("checked");
        // create a div element to replace the input element
        const div = doc.createElement("div");
        div.classList.value = "input-checkbox";
        // add the checked class if the checkbox is checked
        if (checked === "checked" || checked === "true") div.classList.add("checked");
        // replace the input element with the div element
        component.replaceWith(div);
      });
      // replace external embed components with simple links
      const externalEmbedComponents = doc.querySelectorAll("embed-component, div[data-node='embed-component']");
      externalEmbedComponents.forEach((component) => {
        const url = component.getAttribute("data-url") ?? component.getAttribute("url") ?? "";
        const title =
          component.getAttribute("data-title") ?? component.getAttribute("title") ?? component.textContent ?? "";
        if (!url) {
          component.remove();
          return;
        }
        const paragraph = doc.createElement("p");
        paragraph.setAttribute("data-node-type", "embed-component");
        const anchor = doc.createElement("a");
        anchor.setAttribute("href", url);
        anchor.setAttribute("target", "_blank");
        anchor.setAttribute("rel", "noopener noreferrer");
        anchor.textContent = title?.trim() || url;
        paragraph.appendChild(anchor);
        component.replaceWith(paragraph);
      });
      // remove all issue-embed-component elements
      const issueEmbedComponents = doc.querySelectorAll("issue-embed-component");
      issueEmbedComponents.forEach((component) => component.remove());
      // 파일 컴포넌트 처리
      const fileComponents = doc.querySelectorAll("file-component, div[data-file-component='true']");
      fileComponents.forEach((component) => {
        // 파일 정보 추출
        const fileName =
          component.getAttribute("fileName") || component.getAttribute("data-file-name") || "Unknown file";
        const fileSize = Number(component.getAttribute("fileSize") || component.getAttribute("data-file-size") || "0");
        const fileType = component.getAttribute("fileType") || component.getAttribute("data-file-type") || "";

        // 파일 확장자 추출
        const extension = fileName?.split(".").pop()?.toUpperCase() || "";

        // 파일 크기 포맷팅
        const formattedSize = fileSize
          ? fileSize >= 1024 * 1024
            ? `${(fileSize / (1024 * 1024)).toFixed(1)}MB`
            : `${Math.round(fileSize / 1024)}KB`
          : "";

        // 파일 유형에 따른 아이콘 문자 결정
        let iconChar = extension.charAt(0) || "F";
        let iconColor = "#3b82f6"; // 기본 파란색
        let iconBgColor = "#e6efff";
        let iconBorderColor = "#d1e0ff";

        // 파일 유형에 따른 색상 및 아이콘 설정
        if (extension) {
          switch (extension.toLowerCase()) {
            // 문서 파일
            case "pdf":
              iconChar = "P";
              iconColor = "#ff5252";
              iconBgColor = "#ffebee";
              iconBorderColor = "#ffcdd2";
              break;
            case "doc":
            case "docx":
              iconChar = "W";
              iconColor = "#4285f4";
              iconBgColor = "#e8f0fe";
              iconBorderColor = "#c6dafc";
              break;
            case "xls":
            case "xlsx":
              iconChar = "X";
              iconColor = "#0f9d58";
              iconBgColor = "#e6f4ea";
              iconBorderColor = "#ceead6";
              break;
            case "ppt":
            case "pptx":
              iconChar = "P";
              iconColor = "#ff6d01";
              iconBgColor = "#fff3e0";
              iconBorderColor = "#ffe0b2";
              break;
            // 이미지 파일
            case "jpg":
            case "jpeg":
            case "png":
            case "gif":
            case "svg":
              iconChar = "I";
              iconColor = "#673ab7";
              iconBgColor = "#ede7f6";
              iconBorderColor = "#d1c4e9";
              break;
            // 코드 파일
            case "js":
            case "ts":
            case "jsx":
            case "tsx":
              iconChar = "J";
              iconColor = "#f4b400";
              iconBgColor = "#fff8e1";
              iconBorderColor = "#ffe082";
              break;
            case "py":
              iconChar = "P";
              iconColor = "#4285f4";
              iconBgColor = "#e8f0fe";
              iconBorderColor = "#c6dafc";
              break;
            case "java":
              iconChar = "J";
              iconColor = "#f44336";
              iconBgColor = "#ffebee";
              iconBorderColor = "#ffcdd2";
              break;
            case "html":
            case "css":
              iconChar = "H";
              iconColor = "#e91e63";
              iconBgColor = "#fce4ec";
              iconBorderColor = "#f8bbd0";
              break;
            case "json":
            case "xml":
              iconChar = "{ }";
              iconColor = "#00bcd4";
              iconBgColor = "#e0f7fa";
              iconBorderColor = "#b2ebf2";
              break;
            // 압축 파일
            case "zip":
            case "rar":
            case "7z":
            case "tar":
            case "gz":
              iconChar = "Z";
              iconColor = "#795548";
              iconBgColor = "#efebe9";
              iconBorderColor = "#d7ccc8";
              break;
            default:
              iconChar = extension.charAt(0);
              break;
          }
        }

        // 파일 노드를 완전히 새롭게 만듭니다 - 매우 단순한 구조로
        const div = doc.createElement("div");
        div.style.cssText = `
          display: flex;
          flex-direction: row;
          padding: 8px;
          margin: 4px 0;
          border: 1px solid #e5e5e5;
          border-radius: 4px;
          background-color: #fafafa;
          width: 100%;
          font-size: 12px;
          align-items: center;
        `;

        // 왼쪽 아이콘 컨테이너
        const iconContainer = doc.createElement("div");
        iconContainer.style.cssText = `
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          margin-right: 10px;
          flex-shrink: 0;
        `;

        // 아이콘 부분
        const icon = doc.createElement("span");
        icon.style.cssText = `
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 4px;
          background-color: ${iconBgColor};
          border: 1px solid ${iconBorderColor};
          color: ${iconColor};
          font-weight: bold;
          font-size: 12px;
          text-align: center;
        `;
        icon.textContent = iconChar;

        // 오른쪽 컨텐츠 컨테이너
        const contentContainer = doc.createElement("div");
        contentContainer.style.cssText = `
          display: flex;
          flex-direction: column;
          flex-grow: 1;
          min-width: 0;
          justify-content: center;
        `;

        // 파일명 부분
        const name = doc.createElement("div");
        name.style.cssText = `
          font-weight: normal;
          color: #333;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-bottom: 2px;
          line-height: 1.3;
        `;
        name.textContent = fileName;

        // 메타데이터 부분
        const meta = doc.createElement("div");
        meta.style.cssText = `
          color: #888;
          font-size: 10px;
          line-height: 1.3;
        `;
        meta.textContent = `${extension} • ${formattedSize || ""}`;

        // 전체 조립
        contentContainer.appendChild(name);
        contentContainer.appendChild(meta);

        iconContainer.appendChild(icon);

        div.appendChild(iconContainer);
        div.appendChild(contentContainer);

        // 원래 컴포넌트를 새 컴포넌트로 교체
        component.replaceWith(div);
      });
      // serialize the document back into a string
      let serializedDoc = doc.body.innerHTML;
      // remove null colors from table elements
      serializedDoc = serializedDoc.replace(/background-color: null/g, "").replace(/color: null/g, "");
      // 문서 전체에 Helvetica 폰트 적용 및 페이지 너비 문제 해결
      const bodyStyle = doc.createElement("style");
      bodyStyle.textContent = `
        @page {
          margin: 25mm 15mm;
          size: auto;
        }
        
        body {
          font-family: 'Helvetica', sans-serif;
          max-width: 100% !important;
          padding: 0 !important;
          margin: 0 !important;
          box-sizing: border-box !important;
          overflow-x: hidden !important;
          word-break: break-word !important;
        }
        
        /* 모든 요소의 너비를 제한하여 잘리지 않도록 함 */
        div, p, span, h1, h2, h3, h4, h5, h6, table, tr, td, ul, ol, li, pre, code {
          max-width: 100% !important;
          width: auto !important;
          box-sizing: border-box !important;
          word-wrap: break-word !important;
          overflow-wrap: break-word !important;
          white-space: pre-wrap !important;
          overflow: visible !important;
        }
        
        /* 이미지 최대 너비 설정 및 크기 제한 */
        img {
          max-width: 500px !important;
          width: 90% !important;
          height: auto !important;
          display: block !important;
          margin: 10px auto !important;
          object-fit: contain !important;
          page-break-inside: avoid !important;
        }
        
        /* 테이블 스타일 조정 */
        table {
          width: 100% !important;
          max-width: 100% !important;
          table-layout: fixed !important;
          border-collapse: collapse !important;
        }
        
        /* 파일 컴포넌트 너비 제한 */
        div[style*="display: flex"] {
          width: 95% !important;
          max-width: 600px !important;
          margin-left: 0 !important;
        }
      `;

      // 추가: 이미지 및 파일 컴포넌트 조정 - 모든 이미지에 직접 스타일 적용
      const allImages = doc.querySelectorAll("img");
      allImages.forEach((img) => {
        // 기존 스타일 대신 새 스타일 적용
        img.removeAttribute("style"); // 기존 스타일 모두 제거

        // 새 스타일 직접 적용 - 크기 강제 제한
        if (img.hasAttribute("width") && img.getAttribute("width")?.includes("%")) {
          // width 속성이 있고 %가 포함된 경우
          const widthValue = img.getAttribute("width") || "";
          const width = Math.min(parseInt(widthValue), 50);
          img.style.width = `${width}%`;
        } else if (img.hasAttribute("width") && img.getAttribute("width")?.includes("px")) {
          // width 속성이 있고 px가 포함된 경우
          const widthValue = img.getAttribute("width") || "";
          const width = Math.min(parseInt(widthValue), 500);
          img.style.width = `${width}px`;
        } else {
          img.style.width = "90%";
          img.style.maxWidth = "500px";
        }

        img.style.height = "auto";
        img.style.margin = "15px auto";
        img.style.display = "block";
        img.style.objectFit = "contain";
      });

      // 워드랩 적용
      doc.querySelectorAll("div, p, span, td").forEach((el) => {
        // HTMLElement로 타입 캐스팅
        const element = el as HTMLElement;
        if (element.style) {
          element.style.wordWrap = "break-word";
          element.style.overflowWrap = "break-word";
          element.style.wordBreak = "break-word";
          element.style.maxWidth = "100%";
          element.style.overflow = "visible";
        }
      });
      doc.head.appendChild(bodyStyle);
      return serializedDoc;
    },
    [getUserDetails, parseAdditionalEditorContent]
  );

  /**
   * @description function to replace all the custom components from the markdown content
   * @param props
   * @returns {string}
   */
  const replaceCustomComponentsFromMarkdownContent = useCallback(
    (props: { markdownContent: string; noAssets?: boolean }): string => {
      const { markdownContent, noAssets = false } = props;
      let parsedMarkdownContent = markdownContent;
      // replace the matched mention components with [display_name](redirect_url)
      const mentionRegex =
        /<mention-component[^>]*entity_identifier="([^"]+)"[^>]*entity_name="([^"]+)"[^>]*><\/mention-component>/g;
      const originUrl = typeof window !== "undefined" && (window.location.origin ?? "");
      parsedMarkdownContent = parsedMarkdownContent.replace(mentionRegex, (_match, id, entity_type) => {
        const entityType = entity_type as TSearchEntities;
        if (!id || !entityType) return "";
        if (entityType === "user_mention") {
          const userDetails = getUserDetails(id);
          if (!userDetails) return "";
          return `[${userDetails.display_name}](${originUrl}/${workspaceSlug}/profile/${id})`;
        } else {
          const mentionDetails = parseAdditionalEditorContent({
            id,
            entityType,
          });
          if (!mentionDetails) {
            return "";
          } else {
            const { redirectionPath, textContent } = mentionDetails;
            return `[${textContent}](${originUrl}/${redirectionPath})`;
          }
        }
      });
      // replace the matched image components with <img src={src} >
      const imageComponentRegex = /<image-component[^>]*src="([^"]+)"[^>]*>[^]*<\/image-component>/g;
      const imgTagRegex = /<img[^>]*src="([^"]+)"[^>]*\/?>/g;
      if (noAssets) {
        // remove all image components
        parsedMarkdownContent = parsedMarkdownContent.replace(imageComponentRegex, "").replace(imgTagRegex, "");
      } else {
        // replace the matched image components with <img src={src} >
        parsedMarkdownContent = parsedMarkdownContent.replace(
          imageComponentRegex,
          (_match, src) => `<img src="${src}" >`
        );
      }
      // replace external embed components with markdown links
      const externalEmbedRegex =
        /<(embed-component|div)[^>]*(?:data-node=['"]embed-component['"][^>]*)[^>]*>([\s\S]*?)<\/\1>/g;
      parsedMarkdownContent = parsedMarkdownContent.replace(externalEmbedRegex, (match, _tag, innerContent) => {
        const urlMatch = match.match(/(?:data-url|url)="([^"]+)"/i);
        const titleMatch = match.match(/(?:data-title|title)="([^"]+)"/i);
        const anchorTextMatch = innerContent?.match(/<a[^>]*>([^<]*)<\/a>/i);
        const url = urlMatch?.[1] ?? "";
        if (!url) return "";
        const label = (titleMatch?.[1] ?? anchorTextMatch?.[1] ?? url).trim();
        return `[${label || url}](${url})`;
      });
      // remove all issue-embed components
      const issueEmbedRegex = /<issue-embed-component[^>]*>[^]*<\/issue-embed-component>/g;
      parsedMarkdownContent = parsedMarkdownContent.replace(issueEmbedRegex, "");

      // 파일 컴포넌트를 마크다운 형식으로 변환
      const fileComponentRegex =
        /<file-component[^>]*fileName="([^"]+)"[^>]*fileSize="([^"]+)"[^>]*fileType="([^"]+)"[^>]*>[^]*<\/file-component>|<div[^>]*data-file-component="true"[^>]*data-file-name="([^"]+)"[^>]*data-file-size="([^"]+)"[^>]*data-file-type="([^"]+)"[^>]*>[^]*<\/div>/g;
      parsedMarkdownContent = parsedMarkdownContent.replace(
        fileComponentRegex,
        (_match, fileName1, fileSize1, fileType1, fileName2, fileSize2, fileType2) => {
          // 첫 번째 캡처 그룹(file-component) 또는 두 번째 캡처 그룹(div) 중 존재하는 값 사용
          const fileName = fileName1 || fileName2 || "Unknown file";
          const fileSize = Number(fileSize1 || fileSize2 || "0");
          const fileType = fileType1 || fileType2 || "";

          const extension = fileName?.split(".").pop()?.toUpperCase() || "";
          const formattedSize = fileSize
            ? fileSize >= 1024 * 1024
              ? `${(fileSize / (1024 * 1024)).toFixed(1)}MB`
              : `${Math.round(fileSize / 1024)}KB`
            : "";

          // 파일 유형에 따른 이모티콘 선택
          let fileEmoji = "📎"; // 기본 파일 이모티콘

          if (extension) {
            const ext = extension.toLowerCase();
            // 문서 파일
            if (["pdf", "doc", "docx", "txt", "rtf"].includes(ext)) {
              fileEmoji = "📄";
            }
            // 스프레드시트 파일
            else if (["xls", "xlsx", "csv"].includes(ext)) {
              fileEmoji = "📊";
            }
            // 프레젠테이션 파일
            else if (["ppt", "pptx"].includes(ext)) {
              fileEmoji = "📑";
            }
            // 이미지 파일
            else if (["jpg", "jpeg", "png", "gif", "bmp", "svg"].includes(ext)) {
              fileEmoji = "🖼️";
            }
            // 비디오 파일
            else if (["mp4", "avi", "mov", "wmv", "flv", "mkv"].includes(ext)) {
              fileEmoji = "🎬";
            }
            // 오디오 파일
            else if (["mp3", "wav", "ogg", "flac", "aac"].includes(ext)) {
              fileEmoji = "🎵";
            }
            // 압축 파일
            else if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) {
              fileEmoji = "🗜️";
            }
            // 코드 파일
            else if (["js", "ts", "py", "java", "c", "cpp", "cs", "html", "css", "php", "rb"].includes(ext)) {
              fileEmoji = "📝";
            }
          }

          return `${fileEmoji} **${fileName}** (${extension} ${formattedSize ? `• ${formattedSize}` : ""})`;
        }
      );
      return parsedMarkdownContent;
    },
    [getUserDetails, parseAdditionalEditorContent, workspaceSlug]
  );

  const getEditorMetaData = useCallback(
    (htmlContent: string): TCustomComponentsMetaData => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, "text/html");
      const imageMetaData: TCustomComponentsMetaData["file_assets"] = [];
      // process image components
      const imageComponents = doc.querySelectorAll("image-component");
      imageComponents.forEach((element) => {
        const src = element.getAttribute("src");
        if (src) {
          const assetSrc = src.startsWith("http")
            ? src
            : getEditorAssetSrc({
                assetId: src,
                projectId,
                workspaceSlug,
              });
          if (assetSrc) {
            imageMetaData.push({
              id: src,
              name: src,
              url: assetSrc,
            });
          }
        }
      });
      // process user mentions
      const userMentions: TCustomComponentsMetaData["user_mentions"] = [];
      const mentionComponents = doc.querySelectorAll("mention-component");
      mentionComponents.forEach((element) => {
        const id = element.getAttribute("entity_identifier");
        if (id) {
          const userDetails = getUserDetails(id);
          const originUrl = typeof window !== "undefined" && (window.location.origin ?? "");
          const path = `${workspaceSlug}/profile/${id}`;
          const url = `${originUrl}/${path}`;
          if (userDetails) {
            userMentions.push({
              id,
              display_name: userDetails.display_name,
              url,
            });
          }
        }
      });

      return {
        file_assets: imageMetaData,
        user_mentions: userMentions,
      };
    },
    [getUserDetails, projectId, workspaceSlug]
  );

  return {
    replaceCustomComponentsFromHTMLContent,
    replaceCustomComponentsFromMarkdownContent,
    getEditorMetaData,
  };
};
