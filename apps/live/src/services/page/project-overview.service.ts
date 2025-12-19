import { logger } from "@plane/logger";
import { AppError } from "@/lib/errors";
import { APIService } from "../api.service";

interface ProjectOverviewServiceParams {
  workspaceSlug: string | null;
  projectId: string | null;
  cookie: string | null;
  [key: string]: unknown;
}

export type TProjectOverviewPayload = {
  overview_binary: string;
  overview_html: string;
  overview: object;
};

export class ProjectOverviewService extends APIService {
  protected basePath: string;

  constructor(params: ProjectOverviewServiceParams) {
    super();
    const { workspaceSlug, projectId } = params;
    if (!workspaceSlug || !projectId) throw new AppError("Missing required fields.");
    // validate cookie
    if (!params.cookie) throw new AppError("Cookie is required.");
    // set cookie
    this.setHeader("Cookie", params.cookie);
    // set base path
    this.basePath = `/api/workspaces/${workspaceSlug}/projects/${projectId}`;
  }

  /**
   * Fetch project overview description binary
   */
  async fetchDescriptionBinary(): Promise<any> {
    return this.get(`${this.basePath}/overview-description/`, {
      headers: {
        ...this.getHeader(),
        "Content-Type": "application/octet-stream",
      },
      responseType: "arraybuffer",
    })
      .then((response) => response?.data)
      .catch((error) => {
        const appError = new AppError(error, {
          context: { operation: "fetchDescriptionBinary" },
        });
        logger.error("Failed to fetch project overview description binary", appError);
        throw appError;
      });
  }

  /**
   * Update project overview description binary
   */
  async updateDescriptionBinary(data: TProjectOverviewPayload): Promise<any> {
    return this.patch(`${this.basePath}/overview-description/`, data, {
      headers: this.getHeader(),
    })
      .then((response) => response?.data)
      .catch((error) => {
        const appError = new AppError(error, {
          context: { operation: "updateDescriptionBinary" },
        });
        logger.error("Failed to update project overview description binary", appError);
        throw appError;
      });
  }

  /**
   * Fetch project details (used for title sync)
   */
  async fetchDetails(_documentName: string): Promise<{ name: string }> {
    return this.get(this.basePath + "/", {
      headers: this.getHeader(),
    })
      .then((response) => response?.data)
      .catch((error) => {
        const appError = new AppError(error, {
          context: { operation: "fetchDetails" },
        });
        logger.error("Failed to fetch project details for overview", appError);
        throw appError;
      });
  }
}
