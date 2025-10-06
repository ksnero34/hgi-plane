"use client";
import React from "react";
import { AuthRoot } from "@/components/account/auth-forms/auth-root";
import { EAuthModes } from "@/helpers/authentication.helper";
import { AuthFooter } from "./footer";
import { AuthHeader } from "./header";

type AuthBaseProps = {
  authType: EAuthModes;
};

export const AuthBase = ({ authType }: AuthBaseProps) => (
  <div className="flex min-h-screen w-screen flex-col overflow-hidden overflow-y-auto px-8 py-10">
    <div className="flex items-center justify-between gap-4 border-b border-custom-border-200 pb-6">
      <AuthHeader type={authType} />
    </div>
    <div className="mt-8 grid gap-8 lg:grid-cols-5">
      <div className="lg:col-span-3 flex flex-col gap-6">
        <AuthRoot authMode={authType} layout="horizontal" />
      </div>
      <div className="lg:col-span-2 flex flex-col gap-6">
        <AuthFooter layout="horizontal" />
      </div>
    </div>
  </div>
);
