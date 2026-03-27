const SYSTEM_PROMPT =
  'You are an expert in T-slot aluminum extrusion framing systems. ' +
  'Your job is to analyze images of frames and produce structured cut lists.';

const USER_PROMPT =
  'Analyze this T-slot aluminum extrusion frame. Identify each unique profile type ' +
  '(e.g. 20x20mm, 40x40mm, 40x80mm), estimate the quantity and length in inches of each member. ' +
  'Use any visible reference objects, labels, grid lines, or proportional reasoning to estimate dimensions. ' +
  'Be conservative — if unsure, flag low confidence. ' +
  'Respond ONLY with a valid JSON object in this exact format, no prose, no markdown:\n' +
  '{\n' +
  '  "members": [\n' +
  '    { "profile": "40x40", "qty": 4, "length_in": 36 },\n' +
  '    { "profile": "40x80", "qty": 2, "length_in": 24 }\n' +
  '  ],\n' +
  '  "confidence": "medium",\n' +
  '  "notes": "Estimated based on proportional analysis. No scale reference visible."\n' +
  '}';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageData, mediaType } = req.body || {};

  if (!imageData || !mediaType) {
    return res.status(400).json({ error: 'Missing imageData or mediaType' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Anthropic API key not configured on server' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: imageData },
            },
            { type: 'text', text: USER_PROMPT },
          ],
        }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Anthropic API error' });
    }

    const textContent = data.content?.find(c => c.type === 'text')?.text || '';

    try {
      const clean = textContent.replace(/```json\s*|```\s*/g, '').trim();
      const parsed = JSON.parse(clean);
      return res.json(parsed);
    } catch {
      return res.status(422).json({ error: 'Failed to parse AI response', raw: textContent });
    }

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
