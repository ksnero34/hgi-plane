import { makeAutoObservable } from "mobx";
import { TCustomField, TCustomFieldValue } from "@plane/types";
import { CustomFieldService } from "@/services/custom-field.service";

const customFieldService = new CustomFieldService();

export class CustomFieldStore {
  customFields: TCustomField[] = [];
  customFieldValues: { [key: string]: TCustomFieldValue } = {};
  isLoading: boolean = false;

  constructor() {
    makeAutoObservable(this);
  }

  setCustomFields(fields: TCustomField[]) {
    this.customFields = fields;
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
    try {
      this.setLoading(true);
      const fields = await customFieldService.getCustomFields(workspaceSlug, projectId);
      this.setCustomFields(fields);
    } catch (error) {
      console.error("Error fetching custom fields:", error);
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

export const useCustomField = () => {
  if (!store) {
    store = new CustomFieldStore();
  }
  return store;
}; 