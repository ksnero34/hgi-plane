import { ReactNode } from "react";
import { Metadata } from "next";
import { AdminLayout } from "@/layouts/admin-layout";

export const metadata: Metadata = {
  title: "Members Management - Plane Web",
};

export default function MembersLayout({ children }: { children: ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>;
}