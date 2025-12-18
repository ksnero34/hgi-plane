import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ExternalLink, Link2, Pencil, Trash2 } from "lucide-react";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
// plane utils
import { cn, ensureUrlHasProtocol, truncateText } from "@plane/utils";
// local imports
import { ExternalEmbedExtensionConfig } from "./extension-config";

type TExternalEmbedNodeViewProps = NodeViewProps & {
  openInNewTab?: boolean;
};

const getDisplayUrl = (url: string) => {
  if (!url) return "";
  try {
    const parsedUrl = new URL(url);
    return truncateText([parsedUrl.hostname, parsedUrl.pathname].join(""), 64);
  } catch (_error) {
    return truncateText(url.replace(/^https?:\/\//i, ""), 64);
  }
};

const getEmbedInfo = (url: string): { embedUrl: string | null; provider: string | null; isEmbeddable: boolean } => {
  if (!url) return { embedUrl: null, provider: null, isEmbeddable: false };

  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase().replace(/^www\./, "");

    // YouTube
    if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) {
      let videoId = "";
      if (hostname.includes("youtube.com")) {
        videoId = parsedUrl.searchParams.get("v") || "";
        // Handle youtube.com/embed/VIDEO_ID format
        if (!videoId && parsedUrl.pathname.includes("/embed/")) {
          videoId = parsedUrl.pathname.split("/embed/")[1]?.split("/")[0] || "";
        }
      } else if (hostname.includes("youtu.be")) {
        videoId = parsedUrl.pathname.substring(1).split("/")[0];
      }
      if (videoId) {
        return {
          embedUrl: `https://www.youtube.com/embed/${videoId}`,
          provider: "YouTube",
          isEmbeddable: true,
        };
      }
    }

    // Figma
    if (hostname.includes("figma.com")) {
      return {
        embedUrl: `https://www.figma.com/embed?embed_host=plane&url=${encodeURIComponent(url)}`,
        provider: "Figma",
        isEmbeddable: true,
      };
    }

    // Loom
    if (hostname.includes("loom.com") && parsedUrl.pathname.includes("/share/")) {
      return {
        embedUrl: url.replace("/share/", "/embed/"),
        provider: "Loom",
        isEmbeddable: true,
      };
    }

    // Google Drive
    if (hostname.includes("drive.google.com")) {
      return {
        embedUrl: url.replace("/view", "/preview"),
        provider: "Google Drive",
        isEmbeddable: true,
      };
    }

    // Vimeo
    if (hostname.includes("vimeo.com")) {
      const videoId = parsedUrl.pathname.split("/")[1];
      if (videoId) {
        return {
          embedUrl: `https://player.vimeo.com/video/${videoId}`,
          provider: "Vimeo",
          isEmbeddable: true,
        };
      }
    }

    // Google Docs/Sheets/Slides
    if (hostname.includes("docs.google.com")) {
      if (parsedUrl.pathname.includes("/document/")) {
        return {
          embedUrl: url.replace("/edit", "/preview"),
          provider: "Google Docs",
          isEmbeddable: true,
        };
      } else if (parsedUrl.pathname.includes("/spreadsheets/")) {
        return {
          embedUrl: url.replace("/edit", "/preview"),
          provider: "Google Sheets",
          isEmbeddable: true,
        };
      } else if (parsedUrl.pathname.includes("/presentation/")) {
        return {
          embedUrl: url.replace("/edit", "/preview"),
          provider: "Google Slides",
          isEmbeddable: true,
        };
      }
    }

    // Typeform
    if (hostname.includes("typeform.com")) {
      return {
        embedUrl: url,
        provider: "Typeform",
        isEmbeddable: true,
      };
    }

    // Notion
    if (hostname.includes("notion.site") || hostname.includes("notion.so")) {
      return {
        embedUrl: url,
        provider: "Notion",
        isEmbeddable: true,
      };
    }

    // CodePen
    if (hostname.includes("codepen.io") && parsedUrl.pathname.includes("/pen/")) {
      return {
        embedUrl: url.replace("/pen/", "/embed/"),
        provider: "CodePen",
        isEmbeddable: true,
      };
    }

    // GitHub Gist
    if (hostname.includes("gist.github.com")) {
      return {
        embedUrl: `${url}.pibb`,
        provider: "GitHub Gist",
        isEmbeddable: true,
      };
    }

    return { embedUrl: null, provider: null, isEmbeddable: false };
  } catch (_error) {
    return { embedUrl: null, provider: null, isEmbeddable: false };
  }
};

type LinkPreview = {
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
};

const ExternalEmbedNodeView = (props: TExternalEmbedNodeViewProps) => {
  const { node, editor, updateAttributes, deleteNode, selected, openInNewTab = true } = props;
  const isEditable = editor.isEditable;
  const initialUrl = node.attrs.url ?? "";
  const [inputValue, setInputValue] = useState(initialUrl);
  const [isEditing, setIsEditing] = useState(!initialUrl && isEditable);
  const [error, setError] = useState<string | null>(null);
  const [linkPreview, setLinkPreview] = useState<LinkPreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [forceIframe, setForceIframe] = useState<boolean>(node.attrs.isIframe ?? false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const currentUrl = node.attrs.url ?? "";
    setInputValue(currentUrl);
    if (!currentUrl && isEditable) {
      setIsEditing(true);
    }
  }, [node.attrs.url, isEditable]);

  useEffect(() => {
    if (!isEditing) {
      setForceIframe(!!node.attrs.isIframe);
    }
  }, [node.attrs.isIframe, isEditing]);

  // Fetch link preview for non-embeddable URLs
  useEffect(() => {
    const url = node.attrs.url;
    if (!url) return;

    if (node.attrs.isIframe) {
      setLinkPreview(null);
      return;
    }

    const embedInfo = getEmbedInfo(url);
    if (embedInfo.isEmbeddable) {
      setLinkPreview(null);
      return;
    }

    // For non-embeddable URLs, try to fetch Open Graph data
    const fetchLinkPreview = async () => {
      setIsLoadingPreview(true);
      try {
        // Simple client-side extraction from URL
        const parsedUrl = new URL(url);
        const hostname = parsedUrl.hostname.replace(/^www\./, "");
        const favicon = `${parsedUrl.protocol}//${parsedUrl.hostname}/favicon.ico`;

        setLinkPreview({
          title: node.attrs.title || hostname,
          description: node.attrs.description || url,
          image: node.attrs.thumbnail || "",
          favicon: favicon,
        });
      } catch (error) {
        console.error("Failed to fetch link preview:", error);
      } finally {
        setIsLoadingPreview(false);
      }
    };

    fetchLinkPreview();
  }, [node.attrs.description, node.attrs.isIframe, node.attrs.thumbnail, node.attrs.title, node.attrs.url]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleSubmit = useCallback(
    (event?: FormEvent<HTMLFormElement>) => {
      event?.preventDefault();
      const trimmed = inputValue.trim();
      if (!trimmed) {
        setError("링크를 입력해 주세요.");
        return;
      }

      // Check if input is an iframe tag
      if (trimmed.startsWith("<iframe")) {
        const srcMatch = trimmed.match(/src=["'](.*?)["']/);
        if (srcMatch && srcMatch[1]) {
          const src = srcMatch[1];
          try {
            // Validate the extracted URL
            new URL(src);
            updateAttributes?.({
              url: src,
              isIframe: true,
            });
            setForceIframe(true);
            setError(null);
            setIsEditing(false);
            return;
          } catch {
            setError("iframe 소스 URL이 유효하지 않습니다.");
            return;
          }
        } else {
          setError("iframe 태그에서 src 속성을 찾을 수 없습니다.");
          return;
        }
      }

      const normalizedUrl = ensureUrlHasProtocol(trimmed);
      try {
        new URL(normalizedUrl);
        updateAttributes?.({
          url: normalizedUrl,
          isIframe: forceIframe,
        });
        setError(null);
        setIsEditing(false);
      } catch {
        setError("올바른 URL 형식이 아닙니다.");
      }
    },
    [forceIframe, inputValue, updateAttributes]
  );

  const handleEditToggle = useCallback(() => {
    if (!isEditable) return;
    setIsEditing(true);
  }, [isEditable]);

  const handleRemove = useCallback(() => {
    if (!isEditable) return;
    deleteNode?.();
  }, [deleteNode, isEditable]);

  const handleCancel = useCallback(() => {
    setInputValue(node.attrs.url ?? "");
    setError(null);
    if (node.attrs.url) {
      setIsEditing(false);
    }
  }, [node.attrs.url]);

  const displayUrl = useMemo(() => getDisplayUrl(node.attrs.url ?? ""), [node.attrs.url]);

  const embedInfo = useMemo(() => {
    if (node.attrs.isIframe) {
      return {
        embedUrl: node.attrs.url ?? "",
        provider: node.attrs.provider ?? null,
        isEmbeddable: true,
      };
    }

    return getEmbedInfo(node.attrs.url ?? "");
  }, [node.attrs.isIframe, node.attrs.provider, node.attrs.url]);

  const openUrl = useCallback(() => {
    if (!node.attrs.url) return;
    const finalUrl = ensureUrlHasProtocol(node.attrs.url);
    if (openInNewTab) {
      window.open(finalUrl, "_blank", "noopener,noreferrer");
    } else {
      window.location.href = finalUrl;
    }
  }, [node.attrs.url, openInNewTab]);

  const wrapperClassName = cn(
    "editor-embed-component relative !my-3 rounded-lg border border-dashed border-custom-border-300 bg-custom-background-90 text-custom-text-300 transition-all duration-200 ease-in-out hover:border-custom-border-200 hover:bg-custom-background-80 hover:text-custom-text-200",
    {
      "!border-custom-border-200 ring-2 ring-custom-primary-200/60": selected,
      "!border-custom-border-300": !selected,
    }
  );

  return (
    <NodeViewWrapper className={wrapperClassName} data-testid="external-embed-component" as="div">
      {isEditable && (
        <input
          className="pointer-events-none absolute inset-0 size-0 opacity-0"
          tabIndex={-1}
          aria-hidden="true"
          data-ignore-dnd
        />
      )}
      <div
        className="flex w-full flex-col gap-3 px-4 py-3"
        contentEditable={false}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {isEditing && isEditable ? (
          <form className="flex w-full flex-col gap-2" onSubmit={handleSubmit} onMouseDown={(e) => e.stopPropagation()}>
            <label className="flex items-center gap-2 text-sm font-medium text-custom-text-200">
              <Link2 className="size-4 shrink-0" />
              임베드할 링크 입력
            </label>
            <div className="flex w-full gap-2 max-sm:flex-col">
              <input
                ref={inputRef}
                value={inputValue}
                onChange={(event) => {
                  event.stopPropagation();
                  setInputValue(event.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if (event.key === "Escape") {
                    event.preventDefault();
                    handleCancel();
                  }
                }}
                onClick={(event) => {
                  event.stopPropagation();
                }}
                onMouseDown={(event) => {
                  event.stopPropagation();
                }}
                onFocus={(event) => {
                  event.stopPropagation();
                }}
                placeholder="https://example.com"
                className="w-full rounded-md border border-custom-border-200 bg-custom-background-100 px-3 py-2 text-sm text-custom-text outline-none focus:border-custom-primary-100"
              />
              <div className="flex items-center gap-2 max-sm:w-full max-sm:justify-end">
                {node.attrs.url && (
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="rounded-md border border-transparent px-3 py-2 text-sm font-medium text-custom-text-300 hover:text-custom-text-200"
                  >
                    취소
                  </button>
                )}
                <button
                  type="submit"
                  className="rounded-md bg-custom-primary-100 px-3 py-2 text-sm font-medium text-white hover:bg-custom-primary-90"
                >
                  저장
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 text-xs text-custom-text-300">
              <label
                className="inline-flex items-center gap-2"
                onClick={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <input
                  type="checkbox"
                  className="size-3.5"
                  checked={forceIframe}
                  onChange={(event) => {
                    event.stopPropagation();
                    setForceIframe(event.target.checked);
                  }}
                  onClick={(event) => event.stopPropagation()}
                />
                iframe으로 삽입
              </label>
              <span className="text-custom-text-400">지원되지 않는 링크도 iframe으로 직접 표시할 수 있어요.</span>
            </div>
            {error && <p className="text-xs font-medium text-red-500">{error}</p>}
          </form>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Header with controls */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-md bg-custom-background-80 text-custom-text-200">
                  <Link2 className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-custom-text-100">
                    {node.attrs.title || displayUrl || "링크를 설정해 주세요"}
                  </p>
                  {embedInfo.provider ? (
                    <p className="text-xs text-custom-text-300">{embedInfo.provider}</p>
                  ) : node.attrs.provider ? (
                    <p className="text-xs text-custom-text-300">{node.attrs.provider}</p>
                  ) : (
                    node.attrs.url && <p className="text-xs text-custom-text-400">{displayUrl}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {node.attrs.url && (
                  <button
                    type="button"
                    onClick={openUrl}
                    className="flex items-center gap-1 rounded-md border border-transparent px-3 py-2 text-xs font-semibold text-custom-text-200 hover:text-custom-text-100"
                  >
                    열기
                    <ExternalLink className="size-3.5" />
                  </button>
                )}
                {isEditable && (
                  <>
                    <button
                      type="button"
                      onClick={handleEditToggle}
                      className="flex items-center gap-1 rounded-md border border-custom-border-200 px-3 py-2 text-xs font-semibold text-custom-text-300 hover:border-custom-border-300 hover:text-custom-text-200"
                    >
                      <Pencil className="size-3.5" />
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={handleRemove}
                      className="flex items-center gap-1 rounded-md border border-custom-border-200 px-3 py-2 text-xs font-semibold text-red-500 hover:border-red-400 hover:text-red-400"
                    >
                      <Trash2 className="size-3.5" />
                      삭제
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Embed iframe or link preview card */}
            {embedInfo.embedUrl || (node.attrs.isIframe && node.attrs.url) ? (
              <div
                className="relative w-full overflow-hidden rounded-lg bg-custom-background-100"
                style={{ paddingBottom: "56.25%" }}
              >
                <iframe
                  src={embedInfo.embedUrl || node.attrs.url}
                  className="absolute inset-0 size-full border-0"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  title={node.attrs.title || displayUrl || "Embedded content"}
                  loading="lazy"
                />
              </div>
            ) : linkPreview && node.attrs.url ? (
              <div
                className="flex bg-custom-background-80 rounded-lg overflow-hidden border border-custom-border-200 hover:bg-custom-background-70 hover:border-custom-border-300 transition-all duration-300 cursor-pointer"
                onClick={openUrl}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openUrl();
                  }
                }}
                role="button"
                tabIndex={0}
              >
                {linkPreview.image && (
                  <div className="w-[200px] h-[130px] bg-custom-background-70 flex-shrink-0 border-r border-custom-border-200">
                    <img
                      src={linkPreview.image}
                      alt={linkPreview.title || "Preview"}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        // Hide image if failed to load
                        e.currentTarget.parentElement!.style.display = "none";
                      }}
                    />
                  </div>
                )}
                <div className="flex-1 min-w-[180px] p-4">
                  <div className="text-sm leading-5 text-custom-text-100 font-medium whitespace-nowrap overflow-hidden text-ellipsis mb-2.5">
                    {linkPreview.title || displayUrl}
                  </div>
                  {linkPreview.description && (
                    <div className="mt-2.5 text-sm text-custom-text-200 line-clamp-2 mb-2.5">
                      {linkPreview.description}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    {linkPreview.favicon && (
                      <img
                        src={linkPreview.favicon}
                        alt="Site icon"
                        className="w-4 h-4 flex-shrink-0"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    )}
                    <span className="text-sm leading-4 text-custom-text-200 whitespace-nowrap overflow-hidden text-ellipsis">
                      {displayUrl}
                    </span>
                  </div>
                </div>
              </div>
            ) : !node.attrs.url ? (
              <p className="text-sm text-custom-text-400">
                YouTube, Figma, Loom 등 임베드 가능한 링크를 입력하면 바로 문서에서 확인할 수 있어요.
              </p>
            ) : null}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
};

export const ExternalEmbedExtension = (props?: { openInNewTab?: boolean }) =>
  ExternalEmbedExtensionConfig.extend({
    addNodeView() {
      return ReactNodeViewRenderer((nodeViewProps: NodeViewProps) => (
        <ExternalEmbedNodeView {...nodeViewProps} openInNewTab={props?.openInNewTab} />
      ));
    },
  });
