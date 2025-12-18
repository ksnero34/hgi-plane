import { Download } from "lucide-react";
// plane imports
import { Tooltip } from "@plane/ui";

type Props = {
  src: string;
};

export function ImageDownloadAction(props: Props) {
  const { src } = props;

  const handleDownload = () => {
    // 파일과 동일한 방식으로 다운로드 링크 생성
    const link = document.createElement("a");
    link.href = src;
    // HTML5 download 속성 제거 - 서버의 Content-Disposition 헤더에 의존
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Tooltip tooltipContent="Download">
      <button
        type="button"
        onClick={handleDownload}
        className="flex-shrink-0 h-full grid place-items-center text-white/60 hover:text-white transition-colors"
        aria-label="Download image"
      >
        <Download className="size-3" />
      </button>
    </Tooltip>
  );
}
