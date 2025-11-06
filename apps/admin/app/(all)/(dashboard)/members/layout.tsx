import type{ ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Members Management - Plane Web",
};

export default function MembersLayout({ children }: { children: ReactNode }) {
  return children;
}