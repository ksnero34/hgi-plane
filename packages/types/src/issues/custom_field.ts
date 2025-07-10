export type TCustomFieldType = "text" | "number" | "date" | "select" | "multiselect" | "url" | "email" | "project_member" | "project_members";

export type TCustomFieldSettings = {
  min_value?: number;
  max_value?: number;
  predefined_values?: string[];
  validation_regex?: string;
  validation_error_message?: string;
};

export type TCustomField = {
  id: string;
  workspace_id: string;
  project_id: string;
  name: string;
  key: string;
  description?: string;
  field_type: TCustomFieldType;
  is_required: boolean;
  options?: string[];
  settings: TCustomFieldSettings;
  sort_order: number;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
  deleted_at: string | null;
};

export type TCustomFieldValue = {
  id: string;
  workspace_id: string;
  project_id: string;
  custom_field_id: string;
  issue_id: string;
  value: any;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
  deleted_at: string | null;
};

export type TCustomFieldMap = {
  [field_id: string]: TCustomField;
};

export type TCustomFieldValueMap = {
  [issue_id: string]: {
    [field_id: string]: TCustomFieldValue;
  };
}; 