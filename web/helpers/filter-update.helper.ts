// types
import { IIssueFilterOptions } from "@plane/types";
// helpers
import { toggleCustomFieldValue, updateCustomFieldValues } from "./custom-field.helper";

/**
 * @description 필터 업데이트를 위한 값 계산 (커스텀 필드와 일반 필터 모두 처리)
 * @param {keyof IIssueFilterOptions} key - 필터 키
 * @param {string | string[]} value - 추가/제거할 값
 * @param {IIssueFilterOptions} currentFilters - 현재 필터 상태
 * @returns {any} - 업데이트된 필터 값
 */
export const calculateFilterValue = (
  key: keyof IIssueFilterOptions,
  value: string | string[],
  currentFilters: IIssueFilterOptions
): any => {
  // 커스텀 필드의 경우 특별한 처리
  if (key === "custom_fields") {
    const currentCustomFields = currentFilters[key] as string | null;
    
    if (Array.isArray(value)) {
      return updateCustomFieldValues(currentCustomFields, value);
    } else {
      return toggleCustomFieldValue(currentCustomFields, value);
    }
  }

  // 일반 필터의 경우 기존 로직 적용
  const newValues: string[] = [...((currentFilters[key] as string[]) ?? [])];

  if (Array.isArray(value)) {
    value.forEach((val) => {
      const index = newValues.indexOf(val);
      if (index === -1) {
        newValues.push(val);
      } else {
        newValues.splice(index, 1);
      }
    });
  } else {
    const index = newValues.indexOf(value);
    if (index === -1) {
      newValues.push(value);
    } else {
      newValues.splice(index, 1);
    }
  }

  return newValues;
};

/**
 * @description 필터 제거를 위한 값 계산 (커스텀 필드와 일반 필터 모두 처리) - 제네릭 버전
 * @param {string} key - 필터 키
 * @param {string | null} value - 제거할 값
 * @param {T} currentFilters - 현재 필터 상태
 * @returns {any} - 업데이트된 필터 값
 */
export const calculateFilterRemovalValue = <T extends Record<string, any>>(
  key: string,
  value: string | null,
  currentFilters: T
): any => {
  // 커스텀 필드의 경우 특별한 처리
  if (key === "custom_fields") {
    if (!value) return null;
    
    const currentCustomFields = currentFilters[key] as string | null;
    if (!currentCustomFields) return null;
    
    try {
      const parsed = JSON.parse(currentCustomFields);
      const [fieldId, fieldValue] = value.split(":");
      
      if (parsed[fieldId]) {
        parsed[fieldId] = parsed[fieldId].filter((val: string) => val !== fieldValue);
        if (parsed[fieldId].length === 0) {
          delete parsed[fieldId];
        }
      }
      
      return Object.keys(parsed).length > 0 ? JSON.stringify(parsed) : null;
    } catch (error) {
      console.error("커스텀 필드 파싱 오류:", error);
      return null;
    }
  }

  // 일반 필터의 경우
  let newValues = [...((currentFilters[key] as string[]) ?? [])];

  if (!value) {
    newValues = [];
  } else {
    newValues = newValues.filter((val) => val !== value);
  }

  return newValues;
};

/**
 * @description 필터 업데이트 헬퍼 - 각 컨텍스트에서 사용할 수 있는 공통 로직
 * @param {keyof IIssueFilterOptions} key - 필터 키
 * @param {string | string[]} value - 추가/제거할 값
 * @param {IIssueFilterOptions} currentFilters - 현재 필터 상태
 * @param {Function} updateFunction - 각 컨텍스트의 updateFilters 함수
 * @returns {void}
 */
export const handleFilterUpdate = (
  key: keyof IIssueFilterOptions,
  value: string | string[],
  currentFilters: IIssueFilterOptions,
  updateFunction: (filters: Partial<IIssueFilterOptions>) => void
): void => {
  const updatedValue = calculateFilterValue(key, value, currentFilters);
  updateFunction({ [key]: updatedValue });
};

/**
 * @description 필터 제거 헬퍼 - 각 컨텍스트에서 사용할 수 있는 공통 로직 - 제네릭 버전
 * @param {string} key - 필터 키
 * @param {string | null} value - 제거할 값
 * @param {T} currentFilters - 현재 필터 상태
 * @param {Function} updateFunction - 각 컨텍스트의 updateFilters 함수
 * @returns {void}
 */
export const handleFilterRemoval = <T extends Record<string, any>>(
  key: string,
  value: string | null,
  currentFilters: T,
  updateFunction: (filters: Partial<T>) => void
): void => {
  const updatedValue = calculateFilterRemovalValue(key, value, currentFilters);
  updateFunction({ [key]: updatedValue } as Partial<T>);
}; 