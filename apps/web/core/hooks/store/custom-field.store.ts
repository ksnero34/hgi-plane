import { makeAutoObservable } from "mobx";
import { TCustomField, TCustomFieldValue } from "@plane/types";
import { CustomFieldService } from "@/services/custom-field.service";
import { useEffect } from "react";
import { useParams } from "next/navigation";

const customFieldService = new CustomFieldService();

export class CustomFieldStore {
  customFields: TCustomField[] = [];
  customFieldValues: { [key: string]: TCustomFieldValue } = {};
  isLoading: boolean = false;
  _projectId: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  setCustomFields(fields: TCustomField[], projectId: string) {
    this.customFields = fields;
    this._projectId = projectId;
  }

  clearStore() {
    this.customFields = [];
    this._projectId = null;
  }

  setCustomFieldValues(values: { [key: string]: TCustomFieldValue }) {
    this.customFieldValues = values;
  }

  setLoading(loading: boolean) {
    this.isLoading = loading;
  }

  getCustomFields() {
    return this.customFields;
  }

  getCustomFieldValues() {
    return this.customFieldValues;
  }

  async fetchCustomFields(workspaceSlug: string, projectId: string) {
    if (this._projectId === projectId) return;

    try {
      this.setLoading(true);
      const fields = await customFieldService.getCustomFields(workspaceSlug, projectId);
      this.setCustomFields(fields, projectId);
    } catch (error) {
      console.error("Error fetching custom fields:", error);
      this.clearStore();
    } finally {
      this.setLoading(false);
    }
  }

  async fetchCustomFieldValues(workspaceSlug: string, projectId: string, issueId: string) {
    try {
      this.setLoading(true);
      const values = await customFieldService.getCustomFieldValues(workspaceSlug, projectId, issueId);
      this.setCustomFieldValues(values);
    } catch (error) {
      console.error("Error fetching custom field values:", error);
    } finally {
      this.setLoading(false);
    }
  }
}

let store: CustomFieldStore;

export const useCustomField = (projectIdFromProps?: string) => {
  if (!store) {
    store = new CustomFieldStore();
  }

  const { workspaceSlug, projectId: projectIdFromParams } = useParams();
  const projectId = projectIdFromProps || (projectIdFromParams as string);

  useEffect(() => {
    if (workspaceSlug && projectId) {
      store.fetchCustomFields(workspaceSlug as string, projectId);
    } else {
      store.clearStore();
    }
  }, [workspaceSlug, projectId]);

  return store;
}; 