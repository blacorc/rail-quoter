const SYSTEM_PROMPT =
  'You are an expert in T-slot aluminum extrusion framing systems. ' +
  'Your job is to analyze images of frames and produce structured cut lists.';

function buildUserPrompt(family) {
  const profileList = family
    ? family.profiles.map(p => p.name).join(', ')
    : '20x20, 40x40, 40x80, 80x80';
  const familyLabel = family ? family.label : 'T-slot';

  return `Analyze this ${familyLabel} T-slot aluminum extrusion frame. ` +
    `The profiles in this system are: ${profileList}. ` +
    `Identify each unique profile type from that list, estimate the quantity and length in inches of each member. ` +
    `Use any visible reference objects, labels, grid lines, or proportional reasoning to estimate dimensions. ` +
    `Be conservative — if unsure, flag low confidence. ` +
    `Respond ONLY with a valid JSON object in this exact format, no prose, no markdown:\n` +
    `{\n` +
    `  "members": [\n` +
    `    { "profile": "${family ? family.profiles[0]?.name : '40x40'}", "qty": 4, "length_in": 36 },\n` +
    `    { "profile": "${family ? (family.profiles[1]?.name || family.profiles[0]?.name) : '40x80'}", "qty": 2, "length_in": 24 }\n` +
    `  ],\n` +
    `  "confidence": "medium",\n` +
    `  "notes": "Estimated based on proportional analysis. No scale reference visible."\n` +
    `}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageData, mediaType, family } = req.body || {};

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
            { type: 'text', text: buildUserPrompt(family) },
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
