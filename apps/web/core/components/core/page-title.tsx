import { useEffect } from "react";

type PageHeadTitleProps = {
  title?: string;
  description?: string;
};

export const PageHead: React.FC<PageHeadTitleProps> = (props) => {
  const { title } = props;

  useEffect(() => {
    if (title) {
      document.title = title ?? "Plane | HGI suited Issue Traker";
    }
  }, [title]);

  return null;
};
