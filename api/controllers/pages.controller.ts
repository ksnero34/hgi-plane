async updatePageDescription(req, res) {
  const { description_binary, description_html, description } = req.body;
  
  // HTML 콘텐츠에서 개인정보 마스킹
  const maskedHTML = maskPersonalInfo(description_html);
  
  // binary 데이터도 마스킹 처리 필요
  const maskedBinary = maskBinaryContent(description_binary);
  
  // JSON 객체도 마스킹
  const maskedDescription = maskJSONContent(description);

  // 마스킹된 데이터로 업데이트
  const updatedPage = await PageModel.updateDescription({
    description_binary: maskedBinary,
    description_html: maskedHTML,
    description: maskedDescription
  });

  return res.json(updatedPage);
} 