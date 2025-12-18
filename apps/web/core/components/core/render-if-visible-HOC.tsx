import type { ReactNode, MutableRefObject } from "react";
import React, { useState, useRef, useEffect } from "react";
import { cn } from "@plane/utils";

type Props = {
  defaultHeight?: string;
  verticalOffset?: number;
  horizontalOffset?: number;
  root?: MutableRefObject<HTMLElement | null>;
  children: ReactNode;
  as?: keyof JSX.IntrinsicElements;
  classNames?: string;
  placeholderChildren?: ReactNode;
  defaultValue?: boolean;
  shouldRecordHeights?: boolean;
  useIdletime?: boolean;
  forceRender?: boolean;
};

function RenderIfVisible(props: Props) {
  const {
    defaultHeight = "300px",
    root,
    verticalOffset = 50,
    horizontalOffset = 0,
    as = "div",
    children,
    classNames = "",
    shouldRecordHeights = true,
    //placeholder children
    placeholderChildren = null, //placeholder children
    defaultValue = false,
    useIdletime = false,
    forceRender = false,
  } = props;
  const [shouldVisible, setShouldVisible] = useState<boolean>(defaultValue);
  const placeholderHeight = useRef<string>(defaultHeight);
  const intersectionRef = useRef<HTMLElement | null>(null);
  const [visibilityChangeCount, setVisibilityChangeCount] = useState(0);

  const isVisible = shouldVisible || forceRender;

  // Set visibility with intersection observer
  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        setVisibilityChangeCount((count) => count + 1);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (intersectionRef.current) {
      const observer = new IntersectionObserver(
        (entries) => {
          // Check if any entry is intersecting
          const isAnyIntersecting = entries.some((entry) => entry.isIntersecting);

          //DO no remove comments for future
          if (typeof window !== undefined && window.requestIdleCallback && useIdletime) {
            window.requestIdleCallback(() => setShouldVisible(isAnyIntersecting), {
              timeout: 300,
            });
          } else {
            setShouldVisible(isAnyIntersecting);
          }
        },
        {
          root: root?.current,
          rootMargin: `${verticalOffset}% ${horizontalOffset}% ${verticalOffset}% ${horizontalOffset}%`,
        }
      );
      observer.observe(intersectionRef.current);
      return () => {
        if (intersectionRef.current) {
          // eslint-disable-next-line react-hooks/exhaustive-deps
          observer.unobserve(intersectionRef.current);
        }
        observer.disconnect();
      };
    }
  }, [intersectionRef, children, root, verticalOffset, horizontalOffset, visibilityChangeCount]);

  //Set height after render
  useEffect(() => {
    if (intersectionRef.current && isVisible && shouldRecordHeights) {
      window.requestIdleCallback(() => {
        if (intersectionRef.current) placeholderHeight.current = `${intersectionRef.current.offsetHeight}px`;
      });
    }
  }, [isVisible, intersectionRef, shouldRecordHeights]);

  const child = isVisible ? <>{children}</> : placeholderChildren;
  const style = isVisible || !shouldRecordHeights ? {} : { height: placeholderHeight.current, width: "100%" };
  const className = isVisible || placeholderChildren ? classNames : cn(classNames, "bg-custom-background-80");

  return React.createElement(as, { ref: intersectionRef, style, className }, child);
}

export default RenderIfVisible;
