export enum EPageAccess {
  PUBLIC = 0,
  PRIVATE = 1,
}

export type TCreatePageModal = {
  isOpen: boolean;
  pageAccess?: EPageAccess;
  isFolder?: boolean;
  redirectionEnabled?: boolean;
  parentFolderId?: string | null;
};

export const DEFAULT_CREATE_PAGE_MODAL_DATA: TCreatePageModal = {
  isOpen: false,
  pageAccess: EPageAccess.PUBLIC,
  isFolder: false,
  redirectionEnabled: false,
  parentFolderId: null,
};
