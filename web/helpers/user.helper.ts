import { EUserPermissions } from "@/plane-web/constants/user-permissions";

export const getUserRole = (role: EUserPermissions) => {
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
