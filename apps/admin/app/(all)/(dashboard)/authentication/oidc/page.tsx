"use client";

import { useState } from "react";
import { observer } from "mobx-react";
import Image from "next/image";
import useSWR from "swr";
import { Loader, ToggleSwitch, setPromiseToast } from "@plane/ui";
// components
import { AuthenticationMethodCard } from "@/components/authentication";
import { PageHeader } from "@/components/common";
// hooks
import { useInstance } from "@/hooks/store";
// icons
import OIDCLogo from "@/public/logos/oidc-logo.svg";
// local components
import { InstanceOIDCConfigForm } from "./form";

const InstanceOIDCAuthenticationPage = observer(() => {
  // store
  const { fetchInstanceConfigurations, formattedConfig, updateInstanceConfigurations } = useInstance();
  // state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  // config
  const enableOIDCConfig = formattedConfig?.IS_OIDC_ENABLED ?? "";

  void useSWR("INSTANCE_CONFIGURATIONS", () => fetchInstanceConfigurations());

  const updateConfig = async (key: "IS_OIDC_ENABLED", value: string) => {
    setIsSubmitting(true);

    const payload = {
      [key]: value,
    };

    const updateConfigPromise = updateInstanceConfigurations(payload);

    setPromiseToast(updateConfigPromise, {
      loading: "설정 저장 중...",
      success: {
        title: "설정이 저장되었습니다",
        message: () => `OIDC 인증이 ${value ? "활성화" : "비활성화"} 되었습니다.`,
      },
      error: {
        title: "오류",
        message: () => "설정 저장에 실패했습니다",
      },
    });

    await updateConfigPromise
      .then(() => {
        setIsSubmitting(false);
      })
      .catch((err) => {
        console.error(err);
        setIsSubmitting(false);
      });
  };

  return (
    <>
      <PageHeader title="OIDC 인증 - Plane Web" />
      <div className="relative container mx-auto w-full h-full p-4 py-4 space-y-6 flex flex-col">
        <div className="border-b border-custom-border-100 mx-4 py-4 space-y-1 flex-shrink-0">
          <AuthenticationMethodCard
            name="OpenID Connect"
            description="OIDC를 사용하여 사용자가 안전하게 로그인하거나 가입할 수 있도록 허용합니다."
            icon={<Image src={OIDCLogo} height={24} width={24} alt="OIDC Logo" />}
            config={
              <ToggleSwitch
                value={Boolean(parseInt(enableOIDCConfig))}
                onChange={() => {
                  Boolean(parseInt(enableOIDCConfig)) === true
                    ? updateConfig("IS_OIDC_ENABLED", "0")
                    : updateConfig("IS_OIDC_ENABLED", "1");
                }}
                size="sm"
                disabled={isSubmitting || !formattedConfig}
              />
            }
            disabled={isSubmitting || !formattedConfig}
            withBorder={false}
          />
        </div>
        <div className="flex-grow overflow-hidden overflow-y-scroll vertical-scrollbar scrollbar-md px-4">
          {formattedConfig ? (
            <InstanceOIDCConfigForm config={formattedConfig} />
          ) : (
            <Loader className="space-y-8">
              <Loader.Item height="50px" width="25%" />
              <Loader.Item height="50px" />
              <Loader.Item height="50px" />
              <Loader.Item height="50px" />
              <Loader.Item height="50px" width="50%" />
            </Loader>
          )}
        </div>
      </div>
    </>
  );
});

export default InstanceOIDCAuthenticationPage;