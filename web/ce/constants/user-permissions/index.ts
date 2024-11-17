export enum EUserPermissionsLevel {
  WORKSPACE = "WORKSPACE",
  PROJECT = "PROJECT",
}
export type TUserPermissionsLevel = EUserPermissionsLevel;

export enum EUserPermissions {
  ADMIN = 20,
  MEMBER = 15,
  VIEWER = 10,
  RESTRICTED = 8,
  GUEST = 5,
}
export type TUserPermissions = EUserPermissions;

export type TUserAllowedPermissionsObject = {
  create: TUserPermissions[];
  update: TUserPermissions[];
  delete: TUserPermissions[];
  read: TUserPermissions[];
};
export type TUserAllowedPermissions = {
  workspace: {
    [key: string]: Partial<TUserAllowedPermissionsObject>;
  };
  project: {
    [key: string]: Partial<TUserAllowedPermissionsObject>;
  };
};

export const USER_ALLOWED_PERMISSIONS: TUserAllowedPermissions = {
  workspace: {
    dashboard: {
      read: [EUserPermissions.ADMIN, EUserPermissions.MEMBER, EUserPermissions.VIEWER, EUserPermissions.RESTRICTED, EUserPermissions.GUEST],
      create: [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
      update: [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
      delete: [EUserPermissions.ADMIN],
    },
  },
  project: {
    members: {
      read: [EUserPermissions.ADMIN, EUserPermissions.MEMBER, EUserPermissions.VIEWER, EUserPermissions.RESTRICTED, EUserPermissions.GUEST],
      create: [EUserPermissions.ADMIN],
      update: [EUserPermissions.ADMIN],
      delete: [EUserPermissions.ADMIN],
    },
    states: {
      read: [EUserPermissions.ADMIN, EUserPermissions.MEMBER, EUserPermissions.VIEWER, EUserPermissions.RESTRICTED, EUserPermissions.GUEST],
      create: [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
      update: [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
      delete: [EUserPermissions.ADMIN],
    },
    issues: {
      read: [EUserPermissions.ADMIN, EUserPermissions.MEMBER, EUserPermissions.VIEWER, EUserPermissions.RESTRICTED, EUserPermissions.GUEST],
      create: [EUserPermissions.ADMIN, EUserPermissions.MEMBER, EUserPermissions.RESTRICTED],
      update: [EUserPermissions.ADMIN, EUserPermissions.MEMBER, EUserPermissions.RESTRICTED],
      delete: [EUserPermissions.ADMIN],
    },
    user_properties: {
      read: [EUserPermissions.ADMIN, EUserPermissions.MEMBER, EUserPermissions.VIEWER, EUserPermissions.RESTRICTED, EUserPermissions.GUEST],
      create: [EUserPermissions.ADMIN, EUserPermissions.MEMBER, EUserPermissions.VIEWER, EUserPermissions.RESTRICTED, EUserPermissions.GUEST],
      update: [EUserPermissions.ADMIN, EUserPermissions.MEMBER, EUserPermissions.VIEWER, EUserPermissions.RESTRICTED, EUserPermissions.GUEST],
      delete: [EUserPermissions.ADMIN],
    }
  }
};
