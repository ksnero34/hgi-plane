import { useContext } from "react";
// store
import { StoreContext } from "@/lib/store-context";
// types
import { IWorkflowStore } from "@/store/workflow.store";

export const useWorkflow = (): IWorkflowStore => {
  const context = useContext(StoreContext);
  if (context === undefined) throw new Error("useWorkflow must be used within StoreProvider");
  return context.workflow;
};