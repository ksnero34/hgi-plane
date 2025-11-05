"use client";

import type { PageProps } from "@react-pdf/renderer";
import { Document, Font, Page } from "@react-pdf/renderer";
import { Html } from "react-pdf-html";
// constants
import { EDITOR_PDF_DOCUMENT_STYLESHEET } from "@/constants/editor";

// 로컬 한글 폰트 등록
Font.register({
  family: 'Noto Sans KR',
  fonts: [
    { src: '/fonts/noto-sans-kr/NotoSansKR-Regular.ttf', fontWeight: 'normal' },
    { src: '/fonts/noto-sans-kr/NotoSansKR-Bold.ttf', fontWeight: 'bold' },
    { src: '/fonts/noto-sans-kr/NotoSansKR-Medium.ttf', fontWeight: 'medium' },
    { src: '/fonts/noto-sans-kr/NotoSansKR-Light.ttf', fontWeight: 'light' },
  ]
});

// 줄바꿈 처리
Font.registerHyphenationCallback(word => [word]);

// 내장 Courier 폰트 사용 (코드 블록용)
// PDF에 내장된 표준 폰트 사용 - 오프라인에서도 작동
// Helvetica, Times, Courier는 기본 내장 폰트

type Props = {
  content: string;
  pageFormat: PageProps["size"];
};

export const PDFDocument: React.FC<Props> = (props) => {
  const { content, pageFormat } = props;

  return (
    <Document>
      <Page
        size={pageFormat}
        style={{
          backgroundColor: "#ffffff",
          padding: 64,
          fontFamily: "Noto Sans KR"
        }}
      >
        <Html stylesheet={EDITOR_PDF_DOCUMENT_STYLESHEET}>{content}</Html>
      </Page>
    </Document>
  );
};
