// types
import { IIssueFilterOptions } from "@plane/types";

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
export const toggleCustomFieldValue = (
  currentCustomFields: string | null,
  fieldValue: string
): string | null => {
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
export const removeCustomFieldValue = (
  currentCustomFields: string | null,
  fieldValue: string
): string | null => {
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
export const updateCustomFieldValues = (
  currentCustomFields: string | null,
  fieldValues: string[]
): string | null => {
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
 * @description 필터 업데이트 시 커스텀 필드 처리
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
  // 커스텀 필드의 경우 특별한 처리
  if (key === "custom_fields") {
    // value가 이미 JSON 문자열인 경우 그대로 사용
    if (typeof value === "string" && isCustomFieldFilterJSON(value)) {
      return { key, value };
    }
    
    // 객체인 경우 JSON 문자열로 변환
    if (typeof value === "object" && !Array.isArray(value)) {
      return { key, value: stringifyCustomFieldFilter(value) };
    }
    
    // 배열인 경우 기존 로직 적용 후 JSON 문자열로 변환
    const currentCustomFields = parseCustomFieldFilter(currentFilters[key] as any);
    
    if (Array.isArray(value)) {
      // 배열 값 처리 로직
      value.forEach((val) => {
        const [fieldId, fieldValue] = val.split(":");
        if (!currentCustomFields[fieldId]) {
          currentCustomFields[fieldId] = [];
        }
        
        const fieldValues = currentCustomFields[fieldId];
        if (!fieldValues.includes(fieldValue)) {
          fieldValues.push(fieldValue);
        } else {
          fieldValues.splice(fieldValues.indexOf(fieldValue), 1);
          if (fieldValues.length === 0) {
            delete currentCustomFields[fieldId];
          }
        }
      });
    }
    
    return { key, value: stringifyCustomFieldFilter(currentCustomFields) };
  }
  
  // 일반 필터의 경우 기존 로직 적용
  const newValues = currentFilters[key] ?? [];
  
  if (Array.isArray(value)) {
    value.forEach((val) => {
      if (!newValues.includes(val)) newValues.push(val);
      else newValues.splice(newValues.indexOf(val), 1);
    });
  } else {
    if (currentFilters[key]?.includes(value)) {
      newValues.splice(newValues.indexOf(value), 1);
    } else {
      newValues.push(value);
    }
  }
  
  return { key, value: newValues };
}; 