import { ReactNode } from "react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Members Management - Plane Web",
};

export default function MembersLayout({ children }: { children: ReactNode }) {
  return children;
}