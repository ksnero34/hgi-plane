import { observer } from "mobx-react";
// components
import { BulkOperationsUpgradeBanner } from "@/components/issues/bulk-operations/upgrade-banner";
// hooks
import { useMultipleSelectStore } from "@/hooks/store/use-multiple-select-store";
import { TSelectionHelper } from "@/hooks/use-multiple-select";

type Props = {
  className?: string;
  selectionHelpers: TSelectionHelper;
};

export const IssueBulkOperationsRoot: React.FC<Props> = observer((props) => {
  const { className, selectionHelpers } = props;
  // store hooks
  const { isSelectionActive } = useMultipleSelectStore();

  // 업그레이드 배너를 표시하지 않고 null을 반환
  return null;
});
