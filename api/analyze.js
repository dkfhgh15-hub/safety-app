export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { images, zone } = req.body;
    if (!images || images.length === 0) return res.status(400).json({ error: '사진이 없습니다' });

    const imageContents = images.map(img => ({
      type: 'image',
      source: { type: 'base64', media_type: img.mimeType, data: img.data }
    }));

    const prompt = `당신은 대한민국 건설현장 안전관리 전문가입니다.
위 사진 ${images.length}장은 "${zone || '현장'}"에서 촬영된 실제 현장 사진입니다.

[중요] 반드시 실제로 보이는 사진 속 내용만 분석하세요. 사진에 없는 내용을 추가하지 마세요.

각 사진에서 실제로 보이는 위험요인을 분석하여 아래 JSON 형식으로만 응답하세요.
마크다운 코드블록 없이 순수 JSON만 출력하세요.

{"risks":[{"photoIndex":1,"title":"위험요인명","severity":"high","law":"산업안전보건법 제XX조 (조항명)","action":"즉시 조치사항","description":"사진에서 실제로 관찰된 내용 기반 상세 설명"}]}

- photoIndex: 해당 위험요인이 있는 사진 번호 (1부터 시작)
- severity: high(즉시 위험), medium(주의 필요), low(개선 필요) 중 하나
- 위험요인이 없으면: {"risks":[]}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: [...imageContents, { type: 'text', text: prompt }]
        }]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: err.error?.message || 'API 오류' });
    }

    const data = await response.json();
    const rawText = data.content.map(c => c.text || '').join('').trim();
    const cleanText = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleanText);
    res.status(200).json(parsed);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
