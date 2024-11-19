export function maskPersonalInfo(content: string): string {
  // 주민등록번호 마스킹
  content = content.replace(/\d{6}[-]\d{7}/g, (match) => {
    return match.slice(0, 8) + '*'.repeat(6);
  });

  // 전화번호 마스킹
  content = content.replace(/\d{3}[-]\d{4}[-]\d{4}/g, (match) => {
    return match.slice(0, 5) + '****' + match.slice(9);
  });

  // 이메일 마스킹
  content = content.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, (match) => {
    const [localPart, domain] = match.split('@');
    return localPart.slice(0, 2) + '*'.repeat(localPart.length - 2) + '@' + domain;
  });

  return content;
} 