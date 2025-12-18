import type { IUserLite } from "../users";
import type {
  TInstanceAIConfigurationKeys,
  TInstanceEmailConfigurationKeys,
  TInstanceImageConfigurationKeys,
  TInstanceAuthenticationKeys,
  TInstanceWorkspaceConfigurationKeys,
  TCoreLoginMediums,
} from "./";
import type { TExtendedLoginMediums } from "./auth-ee";

export type IInstanceInfo = {
  instance: IInstance;
  config: IInstanceConfig;
};

export type IInstance = {
  id: string;
  created_at: string;
  updated_at: string;
  instance_name: string | undefined;
  whitelist_emails: string | undefined;
  instance_id: string | undefined;
  license_key: string | undefined;
  current_version: string | undefined;
  latest_version: string | undefined;
  last_checked_at: string | undefined;
  namespace: string | undefined;
  is_telemetry_enabled: boolean;
  is_support_required: boolean;
  is_activated: boolean;
  is_setup_done: boolean;
  is_signup_screen_visited: boolean;
  user_count: number | undefined;
  is_verified: boolean;
  created_by: string | undefined;
  updated_by: string | undefined;
  workspaces_exist: boolean;
  fileSettings?: IFileSettings;
};

export type IInstanceConfig = {
  enable_signup: boolean;
  is_workspace_creation_disabled: boolean;
  is_google_enabled: boolean;
  is_github_enabled: boolean;
  is_gitlab_enabled: boolean;
  is_gitea_enabled: boolean;
  is_magic_login_enabled: boolean;
  is_email_password_enabled: boolean;
  github_app_name: string | undefined;
  slack_client_id: string | undefined;
  posthog_api_key: string | undefined;
  posthog_host: string | undefined;
  has_unsplash_configured: boolean;
  has_llm_configured: boolean;
  file_size_limit: number | undefined;
  is_smtp_configured: boolean;
  app_base_url: string | undefined;
  space_base_url: string | undefined;
  admin_base_url: string | undefined;
  is_self_managed: boolean;
  // intercom
  is_intercom_enabled: boolean;
  intercom_app_id: string | undefined;
  is_oidc_enabled: boolean;
  instance_changelog_url?: string;
};

export type IInstanceAdmin = {
  created_at: string;
  created_by: string;
  id: string;
  instance: string;
  role: string;
  updated_at: string;
  updated_by: string;
  user: string;
  user_detail: IUserLite;
};

export type TInstanceIntercomConfigurationKeys = "IS_INTERCOM_ENABLED" | "INTERCOM_APP_ID";

export type TInstanceConfigurationKeys =
  | TInstanceAIConfigurationKeys
  | TInstanceEmailConfigurationKeys
  | TInstanceImageConfigurationKeys
  | TInstanceAuthenticationKeys
  | TInstanceIntercomConfigurationKeys
  | TInstanceWorkspaceConfigurationKeys;

export type IInstanceConfiguration = {
  id: string;
  created_at: string;
  updated_at: string;
  key: TInstanceConfigurationKeys;
  value: string;
  created_by: string | null;
  updated_by: string | null;
};

export type IFormattedInstanceConfiguration = {
  [key in TInstanceConfigurationKeys]: string;
};

export type IFileSettings = {
  allowed_extensions: string[];
  max_file_size: number;
  created_at?: string;
  updated_at?: string;
  id?: string;
  instance?: string;
};

export type IInstanceMember = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  display_name: string;
  avatar?: string;
  created_at?: string;
  updated_at?: string;
};
export type TLoginMediums = TCoreLoginMediums | TExtendedLoginMediums;
