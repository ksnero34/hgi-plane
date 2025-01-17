export type TInstanceAuthenticationModes = {
  key: string;
  name: string;
  description: string;
  icon: JSX.Element;
  config: JSX.Element;
  unavailable?: boolean;
};

export type TInstanceAuthenticationMethodKeys =
  | "ENABLE_SIGNUP"
  | "ENABLE_MAGIC_LINK_LOGIN"
  | "ENABLE_EMAIL_PASSWORD"
  | "IS_GOOGLE_ENABLED"
  | "IS_GITHUB_ENABLED"
  | "IS_GITLAB_ENABLED"
  | "IS_OIDC_ENABLED";

export type TInstanceGoogleAuthenticationConfigurationKeys =
  | "GOOGLE_CLIENT_ID"
  | "GOOGLE_CLIENT_SECRET";

export type TInstanceGithubAuthenticationConfigurationKeys =
  | "GITHUB_CLIENT_ID"
  | "GITHUB_CLIENT_SECRET";

export type TInstanceGitlabAuthenticationConfigurationKeys =
  | "GITLAB_HOST"
  | "GITLAB_CLIENT_ID"
  | "GITLAB_CLIENT_SECRET";

export type TInstanceOIDCAuthenticationConfigurationKeys =
  | "OIDC_CLIENT_ID"
  | "OIDC_CLIENT_SECRET"
  | "OIDC_ISSUER_URL"
  | "OIDC_SCOPES"
  | "OIDC_NAME_CLAIM"
  | "OIDC_EMAIL_CLAIM";

type TInstanceAuthenticationConfigurationKeys =
  | TInstanceGoogleAuthenticationConfigurationKeys
  | TInstanceGithubAuthenticationConfigurationKeys
  | TInstanceGitlabAuthenticationConfigurationKeys
  | TInstanceOIDCAuthenticationConfigurationKeys;

export type TInstanceAuthenticationKeys =
  | TInstanceAuthenticationMethodKeys
  | TInstanceAuthenticationConfigurationKeys;

export type TGetBaseAuthenticationModeProps = {
  disabled: boolean;
  updateConfig: (key: TInstanceAuthenticationMethodKeys, value: string) => void;
  resolvedTheme: string | undefined;
};
