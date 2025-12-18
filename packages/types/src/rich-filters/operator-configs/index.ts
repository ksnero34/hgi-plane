import type { TFilterValue } from "../expression";
import type { EQUALITY_OPERATOR, COLLECTION_OPERATOR, COMPARISON_OPERATOR, TEXT_OPERATOR } from "../operators";
import type {
  TCoreExactOperatorConfigs,
  TCoreInOperatorConfigs,
  TCoreRangeOperatorConfigs,
  TCoreContainsOperatorConfigs,
} from "./core";
import type {
  TExtendedExactOperatorConfigs,
  TExtendedInOperatorConfigs,
  TExtendedOperatorSpecificConfigs,
  TExtendedRangeOperatorConfigs,
  TExtendedContainsOperatorConfigs,
} from "./extended";

// ----------------------------- Composed Operator Configs -----------------------------

/**
 * EXACT operator - combines core and extended configurations
 */
export type TExactOperatorConfigs<V extends TFilterValue> =
  | TCoreExactOperatorConfigs<V>
  | TExtendedExactOperatorConfigs<V>;

/**
 * IN operator - combines core and extended configurations
 */
export type TInOperatorConfigs<V extends TFilterValue> = TCoreInOperatorConfigs<V> | TExtendedInOperatorConfigs<V>;

/**
 * RANGE operator - combines core and extended configurations
 */
export type TRangeOperatorConfigs<V extends TFilterValue> =
  | TCoreRangeOperatorConfigs<V>
  | TExtendedRangeOperatorConfigs<V>;

/**
 * CONTAINS operator - combines core and extended configurations
 */
export type TContainsOperatorConfigs<V extends TFilterValue> =
  | TCoreContainsOperatorConfigs<V>
  | TExtendedContainsOperatorConfigs<V>;

// ----------------------------- Final Operator Specific Configs -----------------------------

/**
 * Type-safe mapping of specific operators to their supported filter type configurations.
 * Each operator maps to its composed (core + extended) configurations.
 */
export type TOperatorSpecificConfigs<V extends TFilterValue> = {
  [EQUALITY_OPERATOR.EXACT]: TExactOperatorConfigs<V>;
  [COLLECTION_OPERATOR.IN]: TInOperatorConfigs<V>;
  [COMPARISON_OPERATOR.RANGE]: TRangeOperatorConfigs<V>;
  [TEXT_OPERATOR.CONTAINS]: TContainsOperatorConfigs<V>;
} & TExtendedOperatorSpecificConfigs<V>;

/**
 * Operator filter configuration mapping - for different operators.
 * Provides type-safe mapping of operators to their specific supported configurations.
 */
export type TOperatorConfigMap<V extends TFilterValue> = Map<
  keyof TOperatorSpecificConfigs<V>,
  TOperatorSpecificConfigs<V>[keyof TOperatorSpecificConfigs<V>]
>;

// -------- RE-EXPORTS --------

export * from "./core";
export * from "./extended";
