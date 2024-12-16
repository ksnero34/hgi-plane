// 개인정보 패턴 정의
const PRIVACY_PATTERNS = {
  // 주민등록번호 (예: 123456-1234567)
  koreanSSN: /\d{6}[-]\d{7}/g,
  // 이메일 주소
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  // 전화번호 (예: 010-1234-5678)
  phoneNumber: /\d{2,3}[-]\d{3,4}[-]\d{4}/g,
  // 신용카드 번호
  creditCard: /\d{4}[-]\d{4}[-]\d{4}[-]\d{4}/g,
};

// 마스킹 처리 함수
export const maskPrivateInformation = (text: string): string => {
  let maskedText = text;
  
  // 전화번호 마스킹 (가운데 4자리)
  maskedText = maskedText.replace(PRIVACY_PATTERNS.phoneNumber, (match) => {
    // 이미 마스킹된 전화번호는 건너뛰기
    if (match.includes("****")) {
      return match;
    }
    const parts = match.split('-');
    if (parts.length === 3) {
      return `${parts[0]}-****-${parts[2]}`;
    }
    return match;
  });

  // 주민등록번호 마스킹 (뒷자리 전체)
  maskedText = maskedText.replace(PRIVACY_PATTERNS.koreanSSN, (match) => {
    if (match.includes("*******")) {
      return match;
    }
    const front = match.split('-')[0];
    return `${front}-*******`;
  });

  // 이메일 마스킹 (@ 앞부분 일부)
  maskedText = maskedText.replace(PRIVACY_PATTERNS.email, (match) => {
    if (match.includes("*")) {
      return match;
    }
    const [local, domain] = match.split('@');
    const maskedLocal = local.substring(0, 3) + '*'.repeat(local.length - 3);
    return `${maskedLocal}@${domain}`;
  });

  // 신용카드 번호 마스킹 (가운데 8자리)
  maskedText = maskedText.replace(PRIVACY_PATTERNS.creditCard, (match) => {
    if (match.includes("****")) {
      return match;
    }
    const parts = match.split('-');
    return `${parts[0]}-****-****-${parts[3]}`;
  });

  return maskedText;
}; 