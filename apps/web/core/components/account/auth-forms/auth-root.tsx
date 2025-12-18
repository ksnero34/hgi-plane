import type { FC } from "react";
import React, { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
// plane imports
import { API_BASE_URL } from "@plane/constants";
import { OAuthOptions as PlaneOAuthOptions } from "@plane/ui";
// assets
import GithubLightLogo from "@/app/assets/logos/github-black.png?url";
import GithubDarkLogo from "@/app/assets/logos/github-dark.svg?url";
import GitlabLogo from "@/app/assets/logos/gitlab-logo.svg?url";
import GoogleLogo from "@/app/assets/logos/google-logo.svg?url";
import OidcLogo from "@/app/assets/logos/oidc-logo.svg?url";
// helpers
import type { TAuthErrorInfo } from "@/helpers/authentication.helper";
import {
  EAuthModes,
  EAuthSteps,
  EAuthenticationErrorCodes,
  EErrorAlertType,
  authErrorHandler,
} from "@/helpers/authentication.helper";
// hooks
import { useInstance } from "@/hooks/store/use-instance";
// local imports
import { TermsAndConditions } from "../terms-and-conditions";
import { AuthBanner } from "./auth-banner";
import { AuthHeader } from "./auth-header";
import { AuthFormRoot } from "./form-root";

type TAuthRoot = {
  authMode: EAuthModes;
};

export const AuthRoot = observer(function AuthRoot(props: TAuthRoot) {
  //router
  const searchParams = useSearchParams();
  // query params
  const emailParam = searchParams.get("email");
  const invitation_id = searchParams.get("invitation_id");
  const workspaceSlug = searchParams.get("slug");
  const error_code = searchParams.get("error_code");
  const next_path = searchParams.get("next_path");
  const { resolvedTheme } = useTheme();
  // props
  const { authMode: currentAuthMode } = props;
  // states
  const [authMode, setAuthMode] = useState<EAuthModes | undefined>(undefined);
  const [authStep, setAuthStep] = useState<EAuthSteps>(EAuthSteps.EMAIL);
  const [email, setEmail] = useState(emailParam ? emailParam.toString() : "");
  const [errorInfo, setErrorInfo] = useState<TAuthErrorInfo | undefined>(undefined);
  const [isDevMode, setIsDevMode] = useState(false);

  // hooks
  const { config } = useInstance();

  // derived values
  const isOAuthEnabled =
    (config &&
      (config?.is_google_enabled ||
        config?.is_github_enabled ||
        config?.is_gitlab_enabled ||
        config?.is_oidc_enabled)) ||
    false;
  const isOIDCEnabled = config?.is_oidc_enabled || false;
  const showEmailLogin = isDevMode || !isOIDCEnabled;

  useEffect(() => {
    if (!authMode && currentAuthMode) setAuthMode(currentAuthMode);
  }, [currentAuthMode, authMode]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsDevMode(localStorage.getItem("devMode") === "true");
    }
  }, []);

  useEffect(() => {
    if (error_code && authMode) {
      const errorhandler = authErrorHandler(error_code?.toString() as EAuthenticationErrorCodes);
      if (errorhandler) {
        // password error handler
        if ([EAuthenticationErrorCodes.AUTHENTICATION_FAILED_SIGN_UP].includes(errorhandler.code)) {
          setAuthMode(EAuthModes.SIGN_UP);
          setAuthStep(EAuthSteps.PASSWORD);
        }
        if ([EAuthenticationErrorCodes.AUTHENTICATION_FAILED_SIGN_IN].includes(errorhandler.code)) {
          setAuthMode(EAuthModes.SIGN_IN);
          setAuthStep(EAuthSteps.PASSWORD);
        }
        // magic_code error handler
        if (
          [
            EAuthenticationErrorCodes.INVALID_MAGIC_CODE_SIGN_UP,
            EAuthenticationErrorCodes.INVALID_EMAIL_MAGIC_SIGN_UP,
            EAuthenticationErrorCodes.EXPIRED_MAGIC_CODE_SIGN_UP,
            EAuthenticationErrorCodes.EMAIL_CODE_ATTEMPT_EXHAUSTED_SIGN_UP,
          ].includes(errorhandler.code)
        ) {
          setAuthMode(EAuthModes.SIGN_UP);
          setAuthStep(EAuthSteps.UNIQUE_CODE);
        }
        if (
          [
            EAuthenticationErrorCodes.INVALID_MAGIC_CODE_SIGN_IN,
            EAuthenticationErrorCodes.INVALID_EMAIL_MAGIC_SIGN_IN,
            EAuthenticationErrorCodes.EXPIRED_MAGIC_CODE_SIGN_IN,
            EAuthenticationErrorCodes.EMAIL_CODE_ATTEMPT_EXHAUSTED_SIGN_IN,
          ].includes(errorhandler.code)
        ) {
          setAuthMode(EAuthModes.SIGN_IN);
          setAuthStep(EAuthSteps.UNIQUE_CODE);
        }

        setErrorInfo(errorhandler);
      }
    }
  }, [error_code, authMode]);

  if (!authMode) return <></>;

  const oauthButtonIntent = authMode === EAuthModes.SIGN_UP ? "Sign up" : "Sign in";

  const handleOAuthRedirect = (provider: string) => {
    const redirect = next_path ? `?next_path=${next_path}` : "";
    window.location.assign(`${API_BASE_URL}/auth/${provider}/${redirect}`);
  };

  const oauthOptions = [
    {
      id: "google",
      text: `${oauthButtonIntent} with Google`,
      icon: <img src={GoogleLogo} className="h-4 w-4 object-contain" alt="Google Logo" />,
      onClick: () => {
        window.location.assign(`${API_BASE_URL}/auth/google/${next_path ? `?next_path=${next_path}` : ``}`);
      },
      enabled: config?.is_google_enabled,
    },
    {
      id: "github",
      text: `${oauthButtonIntent} with GitHub`,
      icon: (
        <img
          src={resolvedTheme === "dark" ? GithubDarkLogo : GithubLightLogo}
          className="h-4 w-4 object-contain"
          alt="GitHub Logo"
        />
      ),
      onClick: () => handleOAuthRedirect("github"),
      enabled: config?.is_github_enabled,
    },
    {
      id: "gitlab",
      text: `${oauthButtonIntent} with GitLab`,
      icon: <img src={GitlabLogo} className="h-4 w-4 object-contain" alt="GitLab Logo" />,
      onClick: () => {
        window.location.assign(`${API_BASE_URL}/auth/gitlab/${next_path ? `?next_path=${next_path}` : ``}`);
      },
      enabled: config?.is_gitlab_enabled,
    },
    {
      id: "oidc",
      text: "한화손해보험 포털ID로 로그인하기",
      icon: <img src={OidcLogo} className="h-4 w-4 object-contain" alt="OIDC Logo" />,
      onClick: () => handleOAuthRedirect("oidc"),
      enabled: config?.is_oidc_enabled,
    },
  ];

  const enabledOAuthOptions = oauthOptions.filter((option) => option.enabled !== false);

  return (
    <div className="flex flex-col justify-center items-center flex-grow w-full py-6 mt-10">
      <div className="relative flex flex-col gap-6 max-w-[22.5rem] w-full">
        {errorInfo && errorInfo?.type === EErrorAlertType.BANNER_ALERT && (
          <AuthBanner bannerData={errorInfo} handleBannerData={(value) => setErrorInfo(value)} />
        )}
        <AuthHeader
          workspaceSlug={workspaceSlug?.toString() || undefined}
          invitationId={invitation_id?.toString() || undefined}
          invitationEmail={email || undefined}
          authMode={authMode}
          currentAuthStep={authStep}
        />

        {isOAuthEnabled && enabledOAuthOptions.length > 0 && (
          <>
            {showEmailLogin ? (
              <PlaneOAuthOptions
                options={oauthOptions}
                compact={authStep === EAuthSteps.PASSWORD}
                containerClassName={authStep === EAuthSteps.PASSWORD ? "mt-0" : ""}
              />
            ) : (
              <div className="grid gap-4">
                {enabledOAuthOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={option.onClick}
                    className={`flex h-[42px] w-full items-center justify-center gap-2 rounded border px-2 text-sm font-medium text-custom-text-100 duration-300 bg-onboarding-background-200 hover:bg-onboarding-background-300 ${
                      resolvedTheme === "dark" ? "border-[#43484F]" : "border-[#D9E4FF]"
                    }`}
                  >
                    <span className="flex items-center justify-center">{option.icon}</span>
                    <span className="flex items-center justify-center">{option.text}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {showEmailLogin && (
          <AuthFormRoot
            authStep={authStep}
            authMode={authMode}
            email={email}
            setEmail={(email) => setEmail(email)}
            setAuthMode={(authMode) => setAuthMode(authMode)}
            setAuthStep={(authStep) => setAuthStep(authStep)}
            setErrorInfo={(errorInfo) => setErrorInfo(errorInfo)}
            currentAuthMode={currentAuthMode}
          />
        )}
        <TermsAndConditions authType={authMode} />
      </div>
    </div>
  );
});
