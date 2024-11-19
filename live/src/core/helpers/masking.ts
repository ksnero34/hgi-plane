/**
 * HTML 콘텐츠에서 개인정보를 마스킹 처리하는 함수
 * @param content HTML 문자열
 * @returns 마스킹 처리된 HTML 문자열
 */
export function maskPersonalInfo(content: string): string {
  if (!content) return content;

  try {
    // 주민등록번호 (예: 123456-1234567)
    content = content.replace(/\d{6}[-]\d{7}/g, (match) => 
      match.slice(0, 8) + '*'.repeat(6));
    
    // 전화번호 (예: 010-1234-5678)
    content = content.replace(/\d{2,3}[-]\d{3,4}[-]\d{4}/g, (match) => {
      const parts = match.split('-');
      return `${parts[0]}-****-${parts[2]}`;
    });
    
    // 이메일 (예: example@domain.com)
    content = content.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, (match) => {
      const [local, domain] = match.split('@');
      return `${local.slice(0, 3)}***@${domain}`;
    });

    // 신용카드 번호 (예: 1234-5678-9012-3456)
    content = content.replace(/\d{4}[-]\d{4}[-]\d{4}[-]\d{4}/g, (match) => 
      match.replace(/\d{4}(?=[-]\d{4}$)/, '****'));

    return content;
  } catch (error) {
    console.error('Error in maskPersonalInfo:', error);
    return content; // 에러 발생시 원본 반환
  }
} 