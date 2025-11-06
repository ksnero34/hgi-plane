import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "기본 워크스페이스 설정 - Plane Admin",
  description: "사용자 가입 시 자동으로 추가될 기본 워크스페이스 설정을 관리합니다.",
};

export default function WorkspaceConfigLayout({ children }: { children: ReactNode }) {
  return children;
}