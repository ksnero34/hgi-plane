// plane imports
import { MAX_FILE_SIZE } from "@/constants/common";
// hooks
import { useInstance } from "@/hooks/store/use-instance";

type TReturnProps = {
  maxFileSize: number;
};

export const useFileSize = (): TReturnProps => {
  // store hooks
  const { fileSettings } = useInstance();

  return {
    maxFileSize: fileSettings?.max_file_size ?? MAX_FILE_SIZE,
  };
};
