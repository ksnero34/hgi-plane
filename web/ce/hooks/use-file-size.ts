// constants
import { MAX_STATIC_FILE_SIZE } from "@/constants/common";
// hooks
import { useInstance } from "@/hooks/store";

type TReturnProps = {
  maxFileSize: number;
};

export const useFileSize = (): TReturnProps => {
  // store hooks
  const { instance } = useInstance();
  const { fileSettings } = instance;

  return {
    maxFileSize: fileSettings?.max_file_size ?? MAX_STATIC_FILE_SIZE,
  };
};
