import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "알림 설정 - Plane Admin",
  description: "REST API 기반 알림 설정을 관리합니다.",
};

export default function NotificationSettingsLayout({ children }: { children: ReactNode }) {
  return children;
}