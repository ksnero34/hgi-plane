import { observer } from "mobx-react";
// components
import { OIDCOAuthButton } from "./oidc-button";
// hooks
import { useInstance } from "@/hooks/store";

export const OAuthOptions: React.FC = observer(() => {
  // hooks
  const { config } = useInstance();

  console.log("OAuth config:", config);

  const isOAuthEnabled = (config && (config?.is_google_enabled || config?.is_github_enabled || config?.is_gitlab_enabled || config?.is_oidc_enabled)) || false;

  console.log("isOAuthEnabled:", isOAuthEnabled);
  console.log("is_oidc_enabled:", config?.is_oidc_enabled);

  if (!isOAuthEnabled) return null;

  return (
    <>
      <div className="mt-4 flex items-center">
        <hr className="w-full border-onboarding-border-100" />
        <p className="mx-3 flex-shrink-0 text-center text-sm text-onboarding-text-400">or</p>
        <hr className="w-full border-onboarding-border-100" />
      </div>
      <div className={`mt-7 grid gap-4 overflow-hidden`}>
        {config?.is_oidc_enabled && <OIDCOAuthButton text="HGI SSO로 로그인하기" />}
      </div>
    </>
  );
}); 