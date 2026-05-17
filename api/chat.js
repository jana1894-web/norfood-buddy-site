export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, language = 'de' } = req.body || {};

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const systemPrompt =
      language === 'en'
        ? 'You are NoRFood Buddy, a helpful onboarding assistant for a food company. Reply in English. Be clear, concise, friendly, and practical.'
        : 'Du bist NoRFood Buddy, ein hilfreicher Onboarding-Assistent für ein Lebensmittelunternehmen. Antworte auf Deutsch. Sei klar, freundlich und praktisch.';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 700,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: message
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Anthropic API error',
        details: data
      });
    }

    const reply =
      data?.content?.[0]?.text || 'Keine Antwort erhalten.';

    return res.status(200).json({ reply });
  } catch (error) {
    return res.status(500).json({
      error: 'Server error',
      details: error.message
    });
  }
}
