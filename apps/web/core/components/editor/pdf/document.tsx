import type { PageProps } from "@react-pdf/renderer";
import { Document, Font, Page } from "@react-pdf/renderer";
import { Html } from "react-pdf-html";
// assets
import interBold from "@/app/assets/fonts/inter/bold.ttf?url";
import interHeavy from "@/app/assets/fonts/inter/heavy.ttf?url";
import interLight from "@/app/assets/fonts/inter/light.ttf?url";
import interMedium from "@/app/assets/fonts/inter/medium.ttf?url";
import interRegular from "@/app/assets/fonts/inter/regular.ttf?url";
import interSemibold from "@/app/assets/fonts/inter/semibold.ttf?url";
import interThin from "@/app/assets/fonts/inter/thin.ttf?url";
import interUltraBold from "@/app/assets/fonts/inter/ultrabold.ttf?url";
import interUltraLight from "@/app/assets/fonts/inter/ultralight.ttf?url";
// constants
import { EDITOR_PDF_DOCUMENT_STYLESHEET } from "@/constants/editor";

// 로컬 한글 폰트 등록
Font.register({
  family: "Noto Sans KR",
  fonts: [
    { src: "/fonts/noto-sans-kr/NotoSansKR-Regular.ttf", fontWeight: "normal" },
    { src: "/fonts/noto-sans-kr/NotoSansKR-Bold.ttf", fontWeight: "bold" },
    { src: "/fonts/noto-sans-kr/NotoSansKR-Medium.ttf", fontWeight: "medium" },
    { src: "/fonts/noto-sans-kr/NotoSansKR-Light.ttf", fontWeight: "light" },
  ],
});

// 줄바꿈 처리
Font.registerHyphenationCallback((word) => [word]);

// 내장 Courier 폰트 사용 (코드 블록용)
// PDF에 내장된 표준 폰트 사용 - 오프라인에서도 작동
// Helvetica, Times, Courier는 기본 내장 폰트

type Props = {
  content: string;
  pageFormat: PageProps["size"];
};

export function PDFDocument(props: Props) {
  const { content, pageFormat } = props;

  return (
    <Document>
      <Page
        size={pageFormat}
        style={{
          backgroundColor: "#ffffff",
          padding: 64,
          fontFamily: "Noto Sans KR",
        }}
      >
        <Html stylesheet={EDITOR_PDF_DOCUMENT_STYLESHEET}>{content}</Html>
      </Page>
    </Document>
  );
}
