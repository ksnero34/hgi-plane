import React from "react";
import { useRouter } from "next/router";
import Link from "next/link";
// hooks
import { useUser } from "hooks/store";
// constants
import { EUserProjectRoles, PROJECT_SETTINGS_LINKS } from "constants/project";

export const ProjectSettingsSidebar = () => {
  const router = useRouter();
  const { workspaceSlug, projectId } = router.query;
  // mobx store
  const {
    membership: { currentProjectRole },
  } = useUser();

  const projectMemberInfo = currentProjectRole || EUserProjectRoles.GUEST;

  return (
    <div className="flex w-80 flex-col gap-6 px-5">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-sidebar-neutral-text-subtle">SETTINGS</span>
        <div className="flex w-full flex-col gap-1">
          {PROJECT_SETTINGS_LINKS.map(
            (link) =>
              projectMemberInfo >= link.access && (
                <Link key={link.key} href={`/${workspaceSlug}/projects/${projectId}${link.href}`}>
                  <div
                    className={`rounded-md px-4 py-2 text-sm font-medium ${
                      link.highlight(router.asPath, `/${workspaceSlug}/projects/${projectId}`)
                        ? "bg-custom-primary-100/10 text-primary-text-subtle"
                        : "text-sidebar-neutral-text-medium hover:bg-sidebar-neutral-component-surface-dark focus:bg-sidebar-neutral-component-surface-dark"
                    }`}
                  >
                    {link.label}
                  </div>
                </Link>
              )
          )}
        </div>
      </div>
    </div>
  );
};
