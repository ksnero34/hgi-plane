import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { Eye, EyeOff } from "lucide-react";
// plane internal packages
import type { EAdminAuthErrorCodes, TAdminAuthErrorInfo } from "@plane/constants";
import { API_BASE_URL } from "@plane/constants";
import { Button } from "@plane/propel/button";
import { AuthService } from "@plane/services";
import { Input, Spinner } from "@plane/ui";
// components
import { Banner } from "@/components/common/banner";
import { useInstance } from "@/hooks/store";
import OIDCLogo from "@/app/assets/logos/oidc-logo.svg?url";
// local components
import { FormHeader } from "../../../core/components/instance/form-header";
import { AuthBanner } from "./auth-banner";
import { AuthHeader } from "./auth-header";
import { authErrorHandler } from "./auth-helpers";

// service initialization
const authService = new AuthService();

// error codes
enum EErrorCodes {
  INSTANCE_NOT_CONFIGURED = "INSTANCE_NOT_CONFIGURED",
  REQUIRED_EMAIL_PASSWORD = "REQUIRED_EMAIL_PASSWORD",
  INVALID_EMAIL = "INVALID_EMAIL",
  USER_DOES_NOT_EXIST = "USER_DOES_NOT_EXIST",
  AUTHENTICATION_FAILED = "AUTHENTICATION_FAILED",
}

type TError = {
  type: EErrorCodes | undefined;
  message: string | undefined;
};

// form data
type TFormData = {
  email: string;
  password: string;
};

const defaultFromData: TFormData = {
  email: "",
  password: "",
};

export function InstanceSignInForm() {
  // search params
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") || undefined;
  const errorCode = searchParams.get("error_code") || undefined;
  const errorMessage = searchParams.get("error_message") || undefined;
  const nextPath = searchParams.get("next_path") || undefined;
  // state
  const [showPassword, setShowPassword] = useState(false);
  const [csrfToken, setCsrfToken] = useState<string | undefined>(undefined);
  const [formData, setFormData] = useState<TFormData>(defaultFromData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorInfo, setErrorInfo] = useState<TAdminAuthErrorInfo | undefined>(undefined);
  // store
  const { config } = useInstance();
  // theme
  const { resolvedTheme } = useTheme();

  const handleFormChange = (key: keyof TFormData, value: string | boolean) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    if (csrfToken === undefined)
      authService.requestCSRFToken().then((data) => data?.csrf_token && setCsrfToken(data.csrf_token));
  }, [csrfToken]);

  useEffect(() => {
    if (emailParam) setFormData((prev) => ({ ...prev, email: emailParam }));
  }, [emailParam]);

  // derived values
  const errorData: TError = useMemo(() => {
    if (errorCode && errorMessage) {
      switch (errorCode) {
        case EErrorCodes.INSTANCE_NOT_CONFIGURED:
          return { type: EErrorCodes.INSTANCE_NOT_CONFIGURED, message: errorMessage };
        case EErrorCodes.REQUIRED_EMAIL_PASSWORD:
          return { type: EErrorCodes.REQUIRED_EMAIL_PASSWORD, message: errorMessage };
        case EErrorCodes.INVALID_EMAIL:
          return { type: EErrorCodes.INVALID_EMAIL, message: errorMessage };
        case EErrorCodes.USER_DOES_NOT_EXIST:
          return { type: EErrorCodes.USER_DOES_NOT_EXIST, message: errorMessage };
        case EErrorCodes.AUTHENTICATION_FAILED:
          return { type: EErrorCodes.AUTHENTICATION_FAILED, message: errorMessage };
        default:
          return { type: undefined, message: undefined };
      }
    } else return { type: undefined, message: undefined };
  }, [errorCode, errorMessage]);

  const isButtonDisabled = useMemo(
    () => (!isSubmitting && formData.email && formData.password ? false : true),
    [formData.email, formData.password, isSubmitting]
  );

  useEffect(() => {
    if (errorCode) {
      const errorDetail = authErrorHandler(errorCode?.toString() as EAdminAuthErrorCodes);
      if (errorDetail) {
        setErrorInfo(errorDetail);
      }
    }
  }, [errorCode]);

  const isOIDCEnabled = Boolean(config?.is_oidc_enabled);

  const handleOIDCSignIn = useCallback(() => {
    const nextPathQuery = nextPath ? `?next_path=${encodeURIComponent(nextPath)}` : "";
    window.location.assign(`${API_BASE_URL}/api/instances/admins/oidc/${nextPathQuery}`);
  }, [nextPath]);

  return (
    <>
      <AuthHeader />
      <div className="flex flex-col justify-center items-center flex-grow w-full py-6 mt-10">
        <div className="relative flex flex-col gap-6 max-w-[22.5rem] w-full">
          <FormHeader
            heading="Manage your Plane instance"
            subHeading="Configure instance-wide settings to secure your instance"
          />
          <form
            className="space-y-4"
            method="POST"
            action={`${API_BASE_URL}/api/instances/admins/sign-in/`}
            onSubmit={() => setIsSubmitting(true)}
            onError={() => setIsSubmitting(false)}
          >
            {errorData.type && errorData?.message ? (
              <Banner type="error" message={errorData?.message} />
            ) : (
              <>
                {errorInfo && <AuthBanner bannerData={errorInfo} handleBannerData={(value) => setErrorInfo(value)} />}
              </>
            )}
            <input type="hidden" name="csrfmiddlewaretoken" value={csrfToken} />

            <div className="w-full space-y-1">
              <label className="text-sm text-custom-text-300 font-medium" htmlFor="email">
                Email <span className="text-red-500">*</span>
              </label>
              <Input
                className="w-full border border-custom-border-100 !bg-custom-background-100 placeholder:text-custom-text-400"
                id="email"
                name="email"
                type="email"
                inputSize="md"
                placeholder="name@company.com"
                value={formData.email}
                onChange={(e) => handleFormChange("email", e.target.value)}
                autoComplete="on"
                autoFocus
              />
            </div>

            <div className="w-full space-y-1">
              <label className="text-sm text-custom-text-300 font-medium" htmlFor="password">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Input
                  className="w-full border border-custom-border-100 !bg-custom-background-100 placeholder:text-custom-text-400"
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  inputSize="md"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(e) => handleFormChange("password", e.target.value)}
                  autoComplete="on"
                />
                {showPassword ? (
                  <button
                    type="button"
                    className="absolute right-3 top-3.5 flex items-center justify-center text-custom-text-400"
                    onClick={() => setShowPassword(false)}
                  >
                    <EyeOff className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="absolute right-3 top-3.5 flex items-center justify-center text-custom-text-400"
                    onClick={() => setShowPassword(true)}
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="py-2">
              <Button type="submit" size="lg" className="w-full" disabled={isButtonDisabled}>
                {isSubmitting ? <Spinner height="20px" width="20px" /> : "Sign in"}
              </Button>
            </div>
          </form>
          {isOIDCEnabled && (
            <>
              <div className="mt-4 flex items-center">
                <hr className="w-full border-onboarding-border-100" />
                <p className="mx-3 flex-shrink-0 text-center text-sm text-onboarding-text-400">or</p>
                <hr className="w-full border-onboarding-border-100" />
              </div>
              <div className="mt-7 grid gap-4 overflow-hidden">
                <button
                  type="button"
                  className={`flex h-[42px] w-full items-center justify-center gap-2 rounded border px-2 text-sm font-medium text-custom-text-100 duration-300 hover:bg-onboarding-background-300 ${
                    resolvedTheme === "dark" ? "border-[#43484F] bg-[#2F3135]" : "border-[#D9E4FF]"
                  }`}
                  onClick={handleOIDCSignIn}
                >
                  <img src={OIDCLogo} height={20} width={20} alt="OIDC Logo" />
                  한화손해보험 포털ID로 로그인하기
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
