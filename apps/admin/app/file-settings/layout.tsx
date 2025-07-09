import { ReactNode } from "react";
import { Metadata } from "next";
import { AdminLayout } from "@/layouts/admin-layout";

export const metadata: Metadata = {
  title: "File Settings - Plane Admin",
  description: "Configure file upload settings for your Plane instance",
};

export default function FileSettingsLayout({ children }: { children: ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>;
}