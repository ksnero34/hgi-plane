import type { TCustomField } from "@plane/types";

export class CustomFieldService {
  async getCustomFields(workspaceSlug: string, projectId: string): Promise<TCustomField[]> {
    const response = await fetch(`/api/workspaces/${workspaceSlug}/projects/${projectId}/custom-fields/`);
    if (!response.ok) {
      throw new Error("Failed to fetch custom fields");
    }
    return response.json();
  }
}
