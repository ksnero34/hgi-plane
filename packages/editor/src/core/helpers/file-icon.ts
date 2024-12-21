import {
  FileIcon,
  Image,
  FileText,
  FileVideo,
  FileAudio,
  Archive,
  FileCode,
  File,
  Table,
  Presentation,
} from "lucide-react";
import { FC } from "react";

type IconComponent = FC<{ className?: string }>;

const FILE_ICONS: Record<string, IconComponent> = {
  // 이미지
  png: Image,
  jpg: Image,
  jpeg: Image,
  gif: Image,
  svg: Image,
  webp: Image,
  
  // 문서
  pdf: File,
  doc: FileText,
  docx: FileText,
  txt: FileText,
  md: FileText,
  rtf: FileText,
  
  // 스프레드시트
  xls: Table,
  xlsx: Table,
  csv: Table,
  
  // 프레젠테이션
  ppt: Presentation,
  pptx: Presentation,
  
  // 코드
  js: FileCode,
  ts: FileCode,
  jsx: FileCode,
  tsx: FileCode,
  html: FileCode,
  css: FileCode,
  json: FileCode,
  
  // 비디오
  mp4: FileVideo,
  webm: FileVideo,
  avi: FileVideo,
  mov: FileVideo,
  
  // 오디오
  mp3: FileAudio,
  wav: FileAudio,
  ogg: FileAudio,
  
  // 압축
  zip: Archive,
  rar: Archive,
  "7z": Archive,
  tar: Archive,
  gz: Archive,
};

export const getFileIconByExtension = (extension: string): IconComponent => {
  return FILE_ICONS[extension.toLowerCase()] || FileIcon;
}; 