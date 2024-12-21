export type TDeleteFile = (src: string) => Promise<void>;
export type TRestoreFile = (src: string) => Promise<void>;
export type TUploadFile = (file: File) => Promise<string>;

export type TFileValidation = {
  /**
   * @description max file size in bytes
   * @example enter 5242880( 5* 1024 * 1024) for 5MB
   */
  maxFileSize?: number;
  /**
   * @description allowed file extensions
   * @example ["pdf", "doc", "docx"]
   */
  allowedExtensions?: string[];
};

export type TFileUploadHandler = {
  getAssetSrc: (path: string) => Promise<string>;
  cancel: () => void;
  delete: TDeleteFile;
  upload: TUploadFile;
  restore: TRestoreFile;
  validation: TFileValidation;
};

export type TFileDisplayConfig = {
  fontStyle?: "sans-serif" | "serif" | "monospace";
  fontSize?: "small-font" | "large-font";
};

export type TFileEntity = {
  file?: File;
  event: "insert" | "drop";
  hasOpenedFileInputOnce?: boolean;
};

export type TFileStorage = {
  fileMap: Map<string, TFileEntity>;
  validation: TFileValidation;
}; 