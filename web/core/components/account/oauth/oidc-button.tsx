import { FC } from "react";
import { useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
// helpers
import { API_BASE_URL } from "@/helpers/common.helper";

export type OIDCOAuthButtonProps = {
  text: string;
};

export const OIDCOAuthButton: FC<OIDCOAuthButtonProps> = (props) => {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next_path") || undefined;
  const { text } = props;
  // hooks
  const { resolvedTheme } = useTheme();

  const handleSignIn = () => {
    window.location.assign(`${API_BASE_URL}/auth/oidc/${nextPath ? `?next_path=${nextPath}` : ``}`);
  };

  return (
    <button
      className={`flex h-[42px] w-full items-center justify-center gap-2 rounded border px-2 text-sm font-medium text-custom-text-100 duration-300 bg-onboarding-background-200 hover:bg-onboarding-background-300 ${
        resolvedTheme === "dark" ? "border-[#43484F]" : "border-[#D9E4FF]"
      }`}
      onClick={handleSignIn}
    >
      <span className="material-icons-outlined text-xl">account_circle</span>
      {text}
    </button>
  );
}; 