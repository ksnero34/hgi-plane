// types
import type { IIssueFilterOptions } from "@plane/types";
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

    // value가 이미 JSON 문자열인 경우 (프로젝트 뷰 등에서 직접 전달)
    if (typeof value === "string" && (value === "" || value.startsWith("{"))) {
      return value || null;
    }

    // value가 "fieldId:value" 형태인 경우 (FilterCustomFields에서 전달)
    if (typeof value === "string" && value.includes(":")) {
      return toggleCustomFieldValue(currentCustomFields, value);
    }

    // value가 단순 문자열인 경우, 컨텍스트에서 fieldId를 추출해야 함
    // 이 경우는 FilterCustomFields에서 handleUpdate가 직접 호출될 때 발생
    // 하지만 이 경우는 handleCustomFieldUpdate에서 처리되므로 여기서는 발생하지 않아야 함

    // 배열인 경우 (다중 값 처리)
    if (Array.isArray(value)) {
      return updateCustomFieldValues(currentCustomFields, value);
    }

    // 기본적으로 toggleCustomFieldValue 사용
    return toggleCustomFieldValue(currentCustomFields, value);
  }

  // 문자열 타입 필터의 경우 (search, name 등)
  if (key === "search" || key === "name") {
    if (Array.isArray(value)) return value;
    return typeof value === "string" ? value : "";
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

    // value가 이미 처리된 JSON 문자열인 경우 (removeCustomFieldFilterValue에서 처리된 결과)
    // 이 경우 그대로 반환
    if (value.startsWith("{") || value === "null") {
      return value === "null" ? null : value;
    }

    // value가 "fieldId:value" 형태인 경우 (직접 제거 요청)
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

  // 문자열 타입 필터의 경우 (search, name 등)
  if (key === "search" || key === "name") {
    return null;
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
