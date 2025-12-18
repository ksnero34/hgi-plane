// types
import type { IIssueFilterOptions } from "@plane/types";
import type { TCustomField } from "@plane/types";
import { calculateFilterValue } from "./filter-update.helper";

/**
 * @description 커스텀 필드 필터 값이 JSON 문자열인지 확인
 * @param {any} value
 * @returns {boolean}
 */
export const isCustomFieldFilterJSON = (value: any): boolean => {
  if (typeof value !== "string") return false;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null;
  } catch {
    return false;
  }
};

/**
 * @description 커스텀 필드 필터 값을 파싱
 * @param {string | { [field_id: string]: string[] }} value
 * @returns {{ [field_id: string]: string[] }}
 */
export const parseCustomFieldFilter = (
  value: string | { [field_id: string]: string[] }
): { [field_id: string]: string[] } => {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return value || {};
};

/**
 * @description 커스텀 필드 필터 값을 JSON 문자열로 변환
 * @param {{ [field_id: string]: string[] }} value
 * @returns {string}
 */
export const stringifyCustomFieldFilter = (value: { [field_id: string]: string[] }): string => {
  return JSON.stringify(value);
};

/**
 * @description 커스텀 필드 JSON에 값 추가/제거 (토글)
 * @param {string | null} currentCustomFields - 현재 커스텀 필드 JSON 문자열
 * @param {string} fieldValue - "fieldId:value" 형태의 값
 * @returns {string | null} - 업데이트된 JSON 문자열 또는 null (빈 객체인 경우)
 */
export const toggleCustomFieldValue = (currentCustomFields: string | null, fieldValue: string): string | null => {
  const parsed = parseCustomFieldFilter(currentCustomFields || "{}");
  const [fieldId, value] = fieldValue.split(":");

  if (!parsed[fieldId]) {
    parsed[fieldId] = [];
  }

  const fieldValues = parsed[fieldId];
  const valueIndex = fieldValues.indexOf(value);

  if (valueIndex === -1) {
    // 값이 없으면 추가
    fieldValues.push(value);
  } else {
    // 값이 있으면 제거
    fieldValues.splice(valueIndex, 1);
    if (fieldValues.length === 0) {
      delete parsed[fieldId];
    }
  }

  // 빈 객체면 null 반환, 아니면 JSON 문자열 반환
  return Object.keys(parsed).length > 0 ? stringifyCustomFieldFilter(parsed) : null;
};

/**
 * @description 커스텀 필드 JSON에서 특정 값 제거
 * @param {string | null} currentCustomFields - 현재 커스텀 필드 JSON 문자열
 * @param {string} fieldValue - "fieldId:value" 형태의 값
 * @returns {string | null} - 업데이트된 JSON 문자열 또는 null (빈 객체인 경우)
 */
export const removeCustomFieldValue = (currentCustomFields: string | null, fieldValue: string): string | null => {
  if (!currentCustomFields) return null;

  const parsed = parseCustomFieldFilter(currentCustomFields);
  const [fieldId, value] = fieldValue.split(":");

  if (parsed[fieldId]) {
    parsed[fieldId] = parsed[fieldId].filter((val: string) => val !== value);
    if (parsed[fieldId].length === 0) {
      delete parsed[fieldId];
    }
  }

  return Object.keys(parsed).length > 0 ? stringifyCustomFieldFilter(parsed) : null;
};

/**
 * @description 커스텀 필드 JSON에 여러 값 추가/제거 (배열 처리)
 * @param {string | null} currentCustomFields - 현재 커스텀 필드 JSON 문자열
 * @param {string[]} fieldValues - "fieldId:value" 형태의 값들 배열
 * @returns {string | null} - 업데이트된 JSON 문자열 또는 null (빈 객체인 경우)
 */
export const updateCustomFieldValues = (currentCustomFields: string | null, fieldValues: string[]): string | null => {
  let result = currentCustomFields;

  fieldValues.forEach((fieldValue) => {
    result = toggleCustomFieldValue(result, fieldValue);
  });

  return result;
};

/**
 * @description 커스텀 필드 필터가 활성화되어 있는지 확인
 * @param {any} customFieldsFilter
 * @returns {boolean}
 */
export const isCustomFieldFilterActive = (customFieldsFilter: any): boolean => {
  if (!customFieldsFilter) return false;

  const parsed = parseCustomFieldFilter(customFieldsFilter);
  return Object.keys(parsed).length > 0;
};

/**
 * @description 커스텀 필드 필터 개수 계산
 * @param {any} customFieldsFilter
 * @returns {number}
 */
export const calculateCustomFieldFilterCount = (customFieldsFilter: any): number => {
  if (!customFieldsFilter) return 0;

  const parsed = parseCustomFieldFilter(customFieldsFilter);
  return Object.values(parsed).reduce((total: number, values: string[]) => total + values.length, 0);
};

/**
 * @description 필터 업데이트 시 커스텀 필드 처리 (이제 calculateFilterValue 사용)
 * @param {keyof IIssueFilterOptions} key
 * @param {string | string[]} value
 * @param {IIssueFilterOptions} currentFilters
 * @returns {{ key: keyof IIssueFilterOptions, value: any }}
 */
export const processFilterUpdate = (
  key: keyof IIssueFilterOptions,
  value: string | string[],
  currentFilters: IIssueFilterOptions
): { key: keyof IIssueFilterOptions; value: any } => {
  // calculateFilterValue 함수를 사용하여 모든 필터를 통일된 방식으로 처리
  const updatedValue = calculateFilterValue(key, value, currentFilters);
  return { key, value: updatedValue };
};

/**
 * 커스텀 필드 필터에서 특정 필드의 특정 값을 제거합니다
 */
export const removeCustomFieldFilterValue = (
  currentCustomFields: string | null,
  fieldId: string,
  valueToRemove: string
): string | null => {
  if (!currentCustomFields) return null;

  const customFieldFilters = parseCustomFieldFilter(currentCustomFields);
  const currentFieldValues = customFieldFilters[fieldId] || [];
  const newFieldValues = currentFieldValues.filter((v) => v !== valueToRemove);

  // undefined 값들을 제거하고 새로운 객체 생성
  const newCustomFieldFilters: { [field_id: string]: string[] } = {};

  // 기존 필드들 복사 (수정된 필드 제외)
  Object.keys(customFieldFilters).forEach((key) => {
    if (key === fieldId) {
      if (newFieldValues.length > 0) {
        newCustomFieldFilters[key] = newFieldValues;
      }
    } else {
      const values = customFieldFilters[key];
      if (values && values.length > 0) {
        newCustomFieldFilters[key] = values;
      }
    }
  });

  return Object.keys(newCustomFieldFilters).length > 0 ? stringifyCustomFieldFilter(newCustomFieldFilters) : null;
};

/**
 * 커스텀 필드 필터에서 특정 필드의 모든 값을 제거합니다
 */
export const removeCustomFieldFilterField = (currentCustomFields: string | null, fieldId: string): string | null => {
  if (!currentCustomFields) return null;

  const customFieldFilters = parseCustomFieldFilter(currentCustomFields);
  const newCustomFieldFilters: { [field_id: string]: string[] } = {};

  // 삭제할 필드 제외하고 복사
  Object.keys(customFieldFilters).forEach((key) => {
    if (key !== fieldId) {
      const values = customFieldFilters[key];
      if (values && values.length > 0) {
        newCustomFieldFilters[key] = values;
      }
    }
  });

  return Object.keys(newCustomFieldFilters).length > 0 ? stringifyCustomFieldFilter(newCustomFieldFilters) : null;
};

/**
 * 커스텀 필드 필터를 렌더링하기 위한 데이터를 준비합니다
 */
export const prepareCustomFieldFiltersForRender = (
  customFieldsValue: string | { [field_id: string]: string[] },
  customFields: TCustomField[]
): Array<{
  fieldId: string;
  field: TCustomField;
  fieldValues: string[];
}> => {
  const customFieldFilters =
    typeof customFieldsValue === "string"
      ? JSON.parse(customFieldsValue)
      : (customFieldsValue as { [field_id: string]: string[] });

  const result: Array<{
    fieldId: string;
    field: TCustomField;
    fieldValues: string[];
  }> = [];

  Object.keys(customFieldFilters).forEach((fieldId) => {
    const fieldValues = customFieldFilters[fieldId];
    if (!fieldValues || !Array.isArray(fieldValues) || fieldValues.length === 0) return;

    const field = customFields.find((f) => f.id === fieldId);
    if (!field) return;

    result.push({
      fieldId,
      field,
      fieldValues,
    });
  });

  return result;
};

/**
 * @description 커스텀 필드 값이 유효한지 확인
 * @param {any} value - 확인할 값
 * @returns {boolean} - 유효한 값인지 여부
 */
export const isValidCustomFieldValue = (value: any): boolean => {
  if (value === null || value === undefined || value === "") {
    return false;
  }

  // 배열인 경우 길이가 0이면 무효
  if (Array.isArray(value) && value.length === 0) {
    return false;
  }

  return true;
};

/**
 * @description 커스텀 필드 값을 안전하게 업데이트 (peek-overview 방식)
 * @param {any[]} currentValues - 현재 커스텀 필드 값 배열
 * @param {string} fieldId - 업데이트할 필드 ID
 * @param {any} newValue - 새로운 값
 * @param {Object} fieldInfo - 필드 정보 객체
 * @param {string} fieldInfo.name - 필드 이름
 * @param {string} fieldInfo.field_type - 필드 타입
 * @returns {any[]} - 업데이트된 커스텀 필드 값 배열
 */
export const updateCustomFieldValueSafely = (
  currentValues: any[],
  fieldId: string,
  newValue: any,
  fieldInfo: { name: string; field_type: string }
): any[] => {
  // 변경할 필드를 제외한 기존 값들 보존 (peek-overview 방식)
  const existingValues = (currentValues || []).filter((cfv) => cfv.custom_field_id !== fieldId);

  // 새 값이 유효한 경우에만 추가
  if (isValidCustomFieldValue(newValue)) {
    const newFieldValue = {
      custom_field_id: fieldId,
      value: newValue,
      field_name: fieldInfo.name,
      field_type: fieldInfo.field_type,
      // MobX 반응성을 위한 타임스탬프 추가
      _updated_at: Date.now(),
    };
    // 완전히 새로운 배열 생성하여 MobX 반응성 보장
    return [...existingValues, newFieldValue];
  }

  // 값이 무효하면 해당 필드 제거된 상태로 반환
  // 빈 배열이라도 새로운 배열 인스턴스 생성
  return [...existingValues];
};

/**
 * @description 커스텀 필드 값 배열에서 특정 필드의 현재 값 조회
 * @param {any[]} customFieldValues - 커스텀 필드 값 배열
 * @param {string} fieldId - 조회할 필드 ID
 * @returns {any} - 필드 값 또는 undefined
 */
export const getCustomFieldValue = (customFieldValues: any[], fieldId: string): any => {
  const fieldValue = customFieldValues?.find((cfv) => cfv.custom_field_id === fieldId);
  return fieldValue?.value;
};
