import React from "react";

import Image from "next/image";

import { useTheme } from "next-themes";
// hooks
import { useUser } from "hooks/store";
// components
import { ComicBoxButton } from "./comic-box-button";
import { Button } from "@plane/ui";
// constant
import { EMPTY_STATE_DETAILS, EmptyStateKeys } from "constants/empty-state";
// helpers
import { cn } from "helpers/common.helper";

type Props = {
  type: EmptyStateKeys;
  size?: "sm" | "md" | "lg";
  layout?: "widget-simple" | "screen-detailed" | "screen-simple";
  additionalPath?: string;
  primaryButtonOnClick?: () => void;
  secondaryButtonOnClick?: () => void;
};

export const EmptyStateComponent: React.FC<Props> = (props) => {
  const {
    type,
    size = "lg",
    layout = "screen-detailed",
    additionalPath = "",
    primaryButtonOnClick,
    secondaryButtonOnClick,
  } = props;
  // store
  const {
    membership: { currentWorkspaceRole, currentProjectRole },
  } = useUser();
  // theme
  const { resolvedTheme } = useTheme();
  // current empty state details
  const { key, title, description, path, primaryButton, secondaryButton, accessType, access } =
    EMPTY_STATE_DETAILS[type];
  // resolved empty state path
  const resolvedEmptyStatePath = `${additionalPath && additionalPath !== "" ? `${path}${additionalPath}` : path}-${
    resolvedTheme === "light" ? "light" : "dark"
  }.webp`;
  // current access type
  const currentAccessType = accessType === "workspace" ? currentWorkspaceRole : currentProjectRole;
  // permission
  const isEditingAllowed = currentAccessType && access && access >= currentAccessType;
  const anyButton = primaryButton || secondaryButton;

  if (layout === "screen-detailed")
    return (
      <div className="flex items-center justify-center min-h-full min-w-full overflow-y-auto py-10 md:px-20 px-5">
        <div
          className={cn("flex flex-col gap-5", {
            "md:min-w-[24rem] max-w-[45rem]": size === "sm",
            "md:min-w-[30rem] max-w-[60rem]": size === "lg",
          })}
        >
          <div className="flex flex-col gap-1.5 flex-shrink">
            {description ? (
              <>
                <h3 className="text-xl font-semibold">{title}</h3>
                <p className="text-sm">{description}</p>
              </>
            ) : (
              <h3 className="text-xl font-medium">{title}</h3>
            )}
          </div>

          {path && (
            <Image
              src={resolvedEmptyStatePath}
              alt={key || "button image"}
              width={384}
              height={250}
              layout="responsive"
              lazyBoundary="100%"
            />
          )}

          {anyButton && (
            <>
              <div className="relative flex items-center justify-center gap-2 flex-shrink-0 w-full">
                {primaryButton && (
                  <div className="relative flex items-start justify-center">
                    {primaryButton.comicBox ? (
                      <ComicBoxButton
                        label={primaryButton.text}
                        icon={primaryButton.icon}
                        title={primaryButton.comicBox?.title}
                        description={primaryButton.comicBox?.description}
                        onClick={primaryButtonOnClick}
                        disabled={!isEditingAllowed}
                      />
                    ) : (
                      <Button
                        size={size}
                        variant="primary"
                        prependIcon={primaryButton.icon}
                        onClick={primaryButtonOnClick}
                        disabled={!isEditingAllowed}
                      >
                        {primaryButton.text}
                      </Button>
                    )}
                  </div>
                )}
                {secondaryButton && (
                  <Button
                    size={size}
                    variant="neutral-primary"
                    prependIcon={secondaryButton.icon}
                    onClick={secondaryButtonOnClick}
                    disabled={!isEditingAllowed}
                  >
                    {secondaryButton.text}
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
};