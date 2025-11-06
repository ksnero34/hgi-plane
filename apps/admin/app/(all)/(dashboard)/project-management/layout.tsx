import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "프로젝트 관리 - Plane Admin",
  description: "프로젝트 이동 등 고급 프로젝트 관리 기능을 제공합니다.",
};

export default function ProjectManagementLayout({ children }: { children: ReactNode }) {
  return children;
}