// plane imports
import { MAX_FILE_SIZE } from "@plane/constants";
// hooks
import { useInstance } from "@/hooks/store/use-instance";

type TReturnProps = {
  maxFileSize: number;
};

export const useFileSize = (): TReturnProps => {
  // store hooks
  const { instance } = useInstance();

  return {
    maxFileSize: instance?.fileSettings?.max_file_size ?? MAX_FILE_SIZE,
  };
};
