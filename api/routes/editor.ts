import { maskPersonalInfo } from '../utils/masking';

router.get('/document/:id', async (req, res) => {
  // 1. DB에서 문서 내용을 가져옴
  const document = await Document.findById(req.params.id);
  
  // 2. 문서 내용에서 개인정보 마스킹 처리
  const maskedContent = maskPersonalInfo(document.content);
  
  // 3. 마스킹된 내용을 클라이언트에 반환
  res.json({ content: maskedContent });
}); 