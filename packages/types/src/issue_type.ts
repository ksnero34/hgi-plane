export interface IIssueType {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  level?: number;
  is_default?: boolean;
  is_epic?: boolean;
  is_active?: boolean;
  workspace?: string;
  project?: string;
  logo_props?: any;
  external_source?: string;
  external_id?: string;
  created_at?: Date;
  updated_at?: Date;
  created_by?: string;
  updated_by?: string;
}

export interface IProjectIssueType {
  id: string;
  issue_type: IIssueType;
  level?: number;
  is_default?: boolean;
  project?: string;
  created_at?: Date;
  updated_at?: Date;
  created_by?: string;
  updated_by?: string;
}