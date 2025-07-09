import { EUserProjectRoles, EUserWorkspaceRoles, EUserPermissions } from "@plane/constants";

export const getUserRole = (role: EUserPermissions | EUserWorkspaceRoles | EUserProjectRoles) => {
  switch (role) {
    case EUserPermissions.GUEST:
      return "GUEST";
    case EUserPermissions.RESTRICTED:
      return "RESTRICTED";
    case EUserPermissions.VIEWER:
      return "VIEWER";
    case EUserPermissions.MEMBER:
      return "MEMBER";
    case EUserPermissions.ADMIN:
      return "ADMIN";
  }
};
