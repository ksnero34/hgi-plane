// 파일 노드 렌더러 컴포넌트
// PDF 변환 시 파일 노드를 시각적으로 표현하기 위한 컴포넌트입니다.
export const FileNodeRenderer = ({
  fileName = "Unknown file",
  fileSize = 0,
  fileType = "",
}: {
  fileName?: string;
  fileSize?: number;
  fileType?: string;
}) => {
  // 파일 확장자 추출
  const extension = fileName?.split(".").pop()?.toUpperCase() || "";

  // 파일 크기 포맷팅 (바이트 -> KB 또는 MB)
  const formattedSize = fileSize
    ? fileSize >= 1024 * 1024
      ? `${(fileSize / (1024 * 1024)).toFixed(1)}MB`
      : `${Math.round(fileSize / 1024)}KB`
    : "";

  return (
    <div
      className="file-node-component"
      data-file-component="true"
      data-file-name={fileName}
      data-file-size={fileSize}
      data-file-type={fileType}
    >
      <div className="file-icon-container">
        <div className="file-icon">{extension.charAt(0)}</div>
      </div>
      <div className="file-info">
        <div className="file-name">{fileName}</div>
        <div className="file-meta">
          <span className="file-extension">{extension}</span>
          {formattedSize && <span className="file-size">{formattedSize}</span>}
        </div>
      </div>
    </div>
  );
};
