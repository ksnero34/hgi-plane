import { API_BASE_URL } from "@plane/constants";
import { TCustomField, TCustomFieldValue } from "@plane/types";

export class CustomFieldService {
  private getEndpoint(workspaceSlug: string, projectId: string) {
    return `${API_BASE_URL}/api/workspaces/${workspaceSlug}/projects/${projectId}/custom-fields`;
  }

  async getCustomFields(workspaceSlug: string, projectId: string): Promise<TCustomField[]> {
    const response = await fetch(this.getEndpoint(workspaceSlug, projectId), {
      credentials: "include",
    });

    if (!response.ok) throw new Error("Failed to fetch custom fields");
    return response.json();
  }

  async getCustomFieldValues(
    workspaceSlug: string,
    projectId: string,
    issueId: string
  ): Promise<{ [key: string]: TCustomFieldValue }> {
    const response = await fetch(
      `${this.getEndpoint(workspaceSlug, projectId)}/${issueId}/values`,
      {
        credentials: "include",
      }
    );

    if (!response.ok) throw new Error("Failed to fetch custom field values");
    return response.json();
  }

  async createCustomField(
    workspaceSlug: string,
    projectId: string,
    data: Partial<TCustomField>
  ): Promise<TCustomField> {
    const response = await fetch(this.getEndpoint(workspaceSlug, projectId), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(data),
    });

    if (!response.ok) throw new Error("Failed to create custom field");
    return response.json();
  }

  async updateCustomField(
    workspaceSlug: string,
    projectId: string,
    fieldId: string,
    data: Partial<TCustomField>
  ): Promise<TCustomField> {
    const response = await fetch(`${this.getEndpoint(workspaceSlug, projectId)}/${fieldId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(data),
    });

    if (!response.ok) throw new Error("Failed to update custom field");
    return response.json();
  }

  async deleteCustomField(workspaceSlug: string, projectId: string, fieldId: string): Promise<void> {
    const response = await fetch(`${this.getEndpoint(workspaceSlug, projectId)}/${fieldId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    if (!response.ok) throw new Error("Failed to delete custom field");
  }
} 