"use client";

import { FC, useState } from "react";
import { EUserPermissions, EUserPermissionsLevel } from "ee/constants/user-permissions";
import { observer } from "mobx-react";
import { PenSquare } from "lucide-react";
// ui
import { Breadcrumbs, Button, Header } from "@plane/ui";
// components
import { BreadcrumbLink } from "@/components/common";
import { CreateUpdateIssueModal } from "@/components/issues";
// constants
import { EIssuesStoreType } from "@/constants/issue";
// hooks
import { useUserPermissions } from "@/hooks/store";

export const DraftsBaseHeader: FC = observer(() => {
  // state
  const [isDraftIssueModalOpen, setIsDraftIssueModalOpen] = useState(false);
  // store hooks
  const { allowPermissions } = useUserPermissions();

  // check if user is authorized to create draft issue
  const isAuthorizedUser = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.WORKSPACE
  );

  return (
    <>
      <CreateUpdateIssueModal
        isOpen={isDraftIssueModalOpen}
        onClose={() => setIsDraftIssueModalOpen(false)}
        storeType={EIssuesStoreType.WORKSPACE_DRAFT}
        isDraft
      />
      <Header>
        <Header.LeftItem>
          <Breadcrumbs>
            <Breadcrumbs.BreadcrumbItem
              type="text"
              link={<BreadcrumbLink label={`Draft`} icon={<PenSquare className="h-4 w-4 text-custom-text-300" />} />}
            />
          </Breadcrumbs>
        </Header.LeftItem>

        <Header.RightItem>
          {/* TODO: Issue & Display filters */}
          <Button
            variant="primary"
            size="sm"
            className="items-center gap-1"
            onClick={() => setIsDraftIssueModalOpen(true)}
            disabled={!isAuthorizedUser}
          >
            Draft <span className="hidden sm:inline-block">issue</span>
          </Button>
        </Header.RightItem>
      </Header>
    </>
  );
});