import { layout, route } from "@react-router/dev/routes";
import type { RouteConfigEntry } from "@react-router/dev/routes";

export const extendedRoutes: RouteConfigEntry[] = [
  layout("./(all)/layout.tsx", [
    layout("./(all)/[workspaceSlug]/layout.tsx", [
      layout("./(all)/[workspaceSlug]/(settings)/layout.tsx", [
        // Workspace Settings extensions
        layout("./(all)/[workspaceSlug]/(settings)/settings/(workspace)/layout.tsx", [
          route(
            ":workspaceSlug/settings/imports",
            "./(all)/[workspaceSlug]/(settings)/settings/(workspace)/imports/page.tsx"
          ),
          route(
            ":workspaceSlug/settings/integrations",
            "./(all)/[workspaceSlug]/(settings)/settings/(workspace)/integrations/page.tsx"
          ),
        ]),
        // Project Settings extensions
        layout("./(all)/[workspaceSlug]/(settings)/settings/projects/layout.tsx", [
          layout("./(all)/[workspaceSlug]/(settings)/settings/projects/[projectId]/layout.tsx", [
            route(
              ":workspaceSlug/settings/projects/:projectId/workflows",
              "./(all)/[workspaceSlug]/(settings)/settings/projects/[projectId]/workflows/page.tsx"
            ),
            route(
              ":workspaceSlug/settings/projects/:projectId/exports",
              "./(all)/[workspaceSlug]/(settings)/settings/projects/[projectId]/exports/page.tsx"
            ),
            route(
              ":workspaceSlug/settings/projects/:projectId/notifications",
              "./(all)/[workspaceSlug]/(settings)/settings/projects/[projectId]/notifications/page.tsx"
            ),
            route(
              ":workspaceSlug/settings/projects/:projectId/custom-fields",
              "./(all)/[workspaceSlug]/(settings)/settings/projects/[projectId]/custom-fields/page.tsx"
            ),
            route(
              ":workspaceSlug/settings/projects/:projectId/issue-types",
              "./(all)/[workspaceSlug]/(settings)/settings/projects/[projectId]/issue-types/page.tsx"
            ),
          ]),
        ]),
      ]),
      // Project App extensions
      layout("./(all)/[workspaceSlug]/(projects)/layout.tsx", [
        layout("./(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/layout.tsx", [
          route(
            ":workspaceSlug/projects/:projectId/overview",
            "./(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/overview/page.tsx"
          ),
        ]),
      ]),
    ]),
  ]),
];
