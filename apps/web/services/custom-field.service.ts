import { API_BASE_URL } from "@plane/constants";
import { APIService } from "@/services/api.service";
import type { TCustomField } from "@plane/types";

export class CustomFieldService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async getCustomFields(workspaceSlug: string, projectId: string): Promise<TCustomField[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/custom-fields/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async createCustomField(
    workspaceSlug: string,
    projectId: string,
    data: Partial<TCustomField>
  ): Promise<TCustomField> {
    return this.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/custom-fields/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async updateCustomField(
    workspaceSlug: string,
    projectId: string,
    customFieldId: string,
    data: Partial<TCustomField>
  ): Promise<TCustomField> {
    return this.patch(`/api/workspaces/${workspaceSlug}/projects/${projectId}/custom-fields/${customFieldId}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async deleteCustomField(workspaceSlug: string, projectId: string, customFieldId: string): Promise<void> {
    return this.delete(`/api/workspaces/${workspaceSlug}/projects/${projectId}/custom-fields/${customFieldId}/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}
