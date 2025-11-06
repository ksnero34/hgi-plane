import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "File Settings - Plane Admin",
  description: "Configure file upload settings for your Plane instance",
};

export default function FileSettingsLayout({ children }: { children: ReactNode }) {
  return children;
}