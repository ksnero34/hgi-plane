"use client";

import { useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import { TInstanceConfigurationKeys } from "@plane/types";
import { Loader, ToggleSwitch, setPromiseToast } from "@plane/ui";
// helpers
import { cn } from "@/helpers/common.helper";
// hooks
import { useInstance } from "@/hooks/store";
// plane admin components
import { AuthenticationModes } from "@/plane-admin/components/authentication";

const InstanceAuthenticationPage = observer(() => {
  // store
  const { fetchInstanceConfigurations, formattedConfig, updateInstanceConfigurations } = useInstance();

  useSWR("INSTANCE_CONFIGURATIONS", () => fetchInstanceConfigurations());

  // state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  // derived values
  const enableSignUpConfig = formattedConfig?.ENABLE_SIGNUP ?? "";

  const updateConfig = async (key: TInstanceConfigurationKeys, value: string) => {
    setIsSubmitting(true);

    const payload = {
      [key]: value,
    };

    const updateConfigPromise = updateInstanceConfigurations(payload);

    setPromiseToast(updateConfigPromise, {
      loading: "설정 저장 중",
      success: {
        title: "성공",
        message: () => "설정이 저장되었습니다",
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
      <div className="relative container mx-auto w-full h-full p-4 py-4 space-y-6 flex flex-col">
        <div className="border-b border-custom-border-100 mx-4 py-4 space-y-1 flex-shrink-0">
          <div className="text-xl font-medium text-custom-text-100">인스턴스의 인증 방식 관리</div>
          <div className="text-sm font-normal text-custom-text-300">
            팀을 위한 인증 방식을 구성하고 가입을 초대 전용으로 제한하세요.
          </div>
        </div>
        <div className="flex-grow overflow-hidden overflow-y-scroll vertical-scrollbar scrollbar-md px-4">
          {formattedConfig ? (
            <div className="space-y-3">
              <div className={cn("w-full flex items-center gap-14 rounded")}>
                <div className="flex grow items-center gap-4">
                  <div className="grow">
                    <div className="text-lg font-medium pb-1">초대 없이도 가입 허용</div>
                    <div className={cn("font-normal leading-5 text-custom-text-300 text-xs")}>
                      이 옵션을 끄면 초대를 받은 사용자만 가입할 수 있습니다.
                    </div>
                  </div>
                </div>
                <div className={`shrink-0 pr-4 ${isSubmitting && "opacity-70"}`}>
                  <div className="flex items-center gap-4">
                    <ToggleSwitch
                      value={Boolean(parseInt(enableSignUpConfig))}
                      onChange={() => {
                        if (Boolean(parseInt(enableSignUpConfig)) === true) {
                          updateConfig("ENABLE_SIGNUP", "0");
                        } else {
                          updateConfig("ENABLE_SIGNUP", "1");
                        }
                      }}
                      size="sm"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </div>
              <div className="text-lg font-medium pt-6">인증 방식</div>
              <AuthenticationModes disabled={isSubmitting} updateConfig={updateConfig} />
            </div>
          ) : (
            <Loader className="space-y-10">
              <Loader.Item height="50px" width="75%" />
              <Loader.Item height="50px" width="75%" />
              <Loader.Item height="50px" width="40%" />
              <Loader.Item height="50px" width="40%" />
              <Loader.Item height="50px" width="20%" />
            </Loader>
          )}
        </div>
      </div>
    </>
  );
});

export default InstanceAuthenticationPage;
