import { FC, useState } from "react";
import isEmpty from "lodash/isEmpty";
import Link from "next/link";
import { useForm } from "react-hook-form";
// types
import { IFormattedInstanceConfiguration } from "@plane/types";
// ui
import { Button, TOAST_TYPE, getButtonStyling, setToast } from "@plane/ui";
// components
import {
  ConfirmDiscardModal,
  ControllerInput,
  CopyField,
  TControllerInputFormField,
  TCopyField,
} from "@/components/common";
// helpers
import { API_BASE_URL, cn } from "@/helpers/common.helper";
// hooks
import { useInstance } from "@/hooks/store";

type Props = {
  config: IFormattedInstanceConfiguration;
};

type OIDCConfigFormValues = {
  OIDC_CLIENT_ID: string;
  OIDC_CLIENT_SECRET: string;
  OIDC_ISSUER_URL: string;
  OIDC_SCOPES: string;
  OIDC_NAME_CLAIM: string;
  OIDC_EMAIL_CLAIM: string;
};

export const InstanceOIDCConfigForm: FC<Props> = (props) => {
  const { config } = props;
  // states
  const [isDiscardChangesModalOpen, setIsDiscardChangesModalOpen] = useState(false);
  // store hooks
  const { updateInstanceConfigurations } = useInstance();

  const {
    handleSubmit,
    control,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<OIDCConfigFormValues>({
    defaultValues: {
      OIDC_CLIENT_ID: config["OIDC_CLIENT_ID"],
      OIDC_CLIENT_SECRET: config["OIDC_CLIENT_SECRET"],
      OIDC_ISSUER_URL: config["OIDC_ISSUER_URL"],
      OIDC_SCOPES: config["OIDC_SCOPES"],
      OIDC_NAME_CLAIM: config["OIDC_NAME_CLAIM"],
      OIDC_EMAIL_CLAIM: config["OIDC_EMAIL_CLAIM"]
    },
  });

  const originURL = !isEmpty(API_BASE_URL) ? API_BASE_URL : typeof window !== "undefined" ? window.location.origin : "";

  const OIDC_FORM_FIELDS: TControllerInputFormField[] = [
    {
      key: "OIDC_ISSUER_URL",
      type: "text",
      label: "발급자 URL",
      description: "OIDC 제공자의 발급자 URL을 입력하세요. (.well-known/openid-configuration 엔드포인트가 있는 URL)",
      placeholder: "https://accounts.google.com",
      error: Boolean(errors.OIDC_ISSUER_URL),
      required: true,
    },
    {
      key: "OIDC_CLIENT_ID",
      type: "text",
      label: "클라이언트 ID",
      description: "OIDC 제공자로부터 발급받은 클라이언트 ID를 입력하세요.",
      placeholder: "your-client-id",
      error: Boolean(errors.OIDC_CLIENT_ID),
      required: true,
    },
    {
      key: "OIDC_CLIENT_SECRET",
      type: "password",
      label: "클라이언트 시크릿",
      description: "OIDC 제공자로부터 발급받은 클라이언트 시크릿을 입력하세요.",
      placeholder: "your-client-secret",
      error: Boolean(errors.OIDC_CLIENT_SECRET),
      required: true,
    },
    {
      key: "OIDC_SCOPES",
      type: "text",
      label: "스코프",
      description: "요청할 OIDC 스코프를 입력하세요. (공백으로 구분)",
      placeholder: "openid profile email",
      error: Boolean(errors.OIDC_SCOPES),
      required: true,
    },
    {
      key: "OIDC_NAME_CLAIM",
      type: "text",
      label: "이름 클레임",
      description: "사용자 이름으로 사용할 ID 토큰의 클레임을 입력하세요.",
      placeholder: "name",
      error: Boolean(errors.OIDC_NAME_CLAIM),
      required: true,
    },
    {
      key: "OIDC_EMAIL_CLAIM",
      type: "text",
      label: "이메일 클레임",
      description: "사용자 이메일로 사용할 ID 토큰의 클레임을 입력하세요.",
      placeholder: "email",
      error: Boolean(errors.OIDC_EMAIL_CLAIM),
      required: true,
    }
  ];

  const OIDC_SERVICE_FIELD: TCopyField[] = [
    {
      key: "Callback_URL",
      label: "리디렉션 URI",
      url: `${originURL}/auth/oidc/callback/`,
      description: "이 URL을 OIDC 제공자의 허용된 리디렉션 URI로 등록하세요."
    },
    {
      key: "Admin_Callback_URL",
      label: "관리자 리디렉션 URI",
      url: `${originURL}/api/instances/admins/oidc/callback/`,
      description: "이 URL을 OIDC 제공자의 허용된 관리자 리디렉션 URI로 등록하세요."
    }
  ];

  const onSubmit = async (formData: OIDCConfigFormValues) => {
    const payload: Partial<OIDCConfigFormValues> = { ...formData };

    await updateInstanceConfigurations(payload)
      .then((response = []) => {
        setToast({
          type: TOAST_TYPE.SUCCESS,
          title: "성공!",
          message: "OIDC 인증 설정이 저장되었습니다. 지금 테스트해보세요.",
        });
        reset({
          OIDC_CLIENT_ID: response.find((item) => item.key === "OIDC_CLIENT_ID")?.value,
          OIDC_CLIENT_SECRET: response.find((item) => item.key === "OIDC_CLIENT_SECRET")?.value,
          OIDC_ISSUER_URL: response.find((item) => item.key === "OIDC_ISSUER_URL")?.value,
          OIDC_SCOPES: response.find((item) => item.key === "OIDC_SCOPES")?.value,
          OIDC_NAME_CLAIM: response.find((item) => item.key === "OIDC_NAME_CLAIM")?.value,
          OIDC_EMAIL_CLAIM: response.find((item) => item.key === "OIDC_EMAIL_CLAIM")?.value
        });
      })
      .catch((err) => console.error(err));
  };

  const handleGoBack = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    if (isDirty) {
      e.preventDefault();
      setIsDiscardChangesModalOpen(true);
    }
  };

  return (
    <>
      <ConfirmDiscardModal
        isOpen={isDiscardChangesModalOpen}
        onDiscardHref="/authentication"
        handleClose={() => setIsDiscardChangesModalOpen(false)}
      />
      <div className="flex flex-col gap-8">
        <div className="grid grid-cols-2 gap-x-12 gap-y-8 w-full">
          <div className="flex flex-col gap-y-4 col-span-2 md:col-span-1 pt-1">
            <div className="pt-2.5 text-xl font-medium">OIDC 제공자 설정</div>
            {OIDC_FORM_FIELDS.map((field) => (
              <ControllerInput
                key={field.key}
                control={control}
                type={field.type}
                name={field.key}
                label={field.label}
                description={field.description}
                placeholder={field.placeholder}
                error={field.error}
                required={field.required}
              />
            ))}
            <div className="flex flex-col gap-1 pt-4">
              <div className="flex items-center gap-4">
                <Button variant="primary" onClick={handleSubmit(onSubmit)} loading={isSubmitting} disabled={!isDirty}>
                  {isSubmitting ? "저장 중..." : "변경사항 저장"}
                </Button>
                <Link
                  href="/authentication"
                  className={cn(getButtonStyling("link-neutral", "md"), "font-medium")}
                  onClick={handleGoBack}
                >
                  돌아가기
                </Link>
              </div>
            </div>
          </div>
          <div className="col-span-2 md:col-span-1">
            <div className="flex flex-col gap-y-4 px-6 pt-1.5 pb-4 bg-custom-background-80/60 rounded-lg">
              <div className="pt-2 text-xl font-medium">Plane 애플리케이션 정보</div>
              {OIDC_SERVICE_FIELD.map((field) => (
                <CopyField key={field.key} label={field.label} url={field.url} description={field.description} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};