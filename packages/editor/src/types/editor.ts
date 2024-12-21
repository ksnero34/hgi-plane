export type TFileHandler = {
  upload: (file: File) => Promise<string>;
  delete: (fileId: string) => Promise<void>;
  restore: (fileId: string) => Promise<void>;
  validateFile?: (file: File) => Promise<boolean>;
  getAssetSrc?: (path: string) => Promise<string>;
  workspaceSlug?: string;
  projectId?: string;
}; 