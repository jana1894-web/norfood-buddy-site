export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, language = 'de' } = req.body || {};

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const needleApiKey = process.env.NEEDLE_API_KEY;
    const needleCollectionId = process.env.NEEDLE_COLLECTION_ID;
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

    if (!needleApiKey) {
      return res.status(500).json({ error: 'Missing NEEDLE_API_KEY' });
    }

    if (!needleCollectionId) {
      return res.status(500).json({ error: 'Missing NEEDLE_COLLECTION_ID' });
    }

    if (!anthropicApiKey) {
      return res.status(500).json({ error: 'Missing ANTHROPIC_API_KEY' });
    }

    let needleContext = '';

    try {
      const needleUrl = `https://search.needle.app/api/v1/collections/${needleCollectionId}/search`;
      console.log('NEEDLE URL:', needleUrl);

      const needleResponse = await fetch(needleUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': needleApiKey
        },
        body: JSON.stringify({
          text: message
        })
      });

      const needleText = await needleResponse.text();
      console.log('NEEDLE STATUS:', needleResponse.status);
      console.log('NEEDLE RAW:', needleText);

      let needleData = {};
      try {
        needleData = JSON.parse(needleText);
      } catch (e) {
        needleData = {};
      }

      console.log('NEEDLE DATA:', JSON.stringify(needleData));

      if (needleResponse.ok) {
        const results =
          needleData?.results ||
          needleData?.matches ||
          needleData?.documents ||
          needleData?.data ||
          needleData ||
          [];

        needleContext = (Array.isArray(results) ? results : [])
          .map((item, index) => {
            const text =
              item?.content ||
              item?.text ||
              item?.chunk ||
              item?.document ||
              item?.metadata?.text ||
              item?.fields?.text ||
              '';

            const title =
              item?.title ||
              item?.name ||
              item?.metadata?.title ||
              item?.fields?.title ||
              `Dokument ${index + 1}`;

            return text ? `[${title}]\n${text}` : '';
          })
          .filter(Boolean)
          .join('\n\n---\n\n');
      }
    } catch (needleError) {
      console.error('Needle search failed:', needleError);
    }

    const systemPrompt =
      language === 'en'
        ? `You are NoRFood Buddy, a warm and practical onboarding assistant for NoRFood employees.
Reply in English.
Use the provided knowledge context when it is relevant.
If the knowledge context contains the answer, prioritize it.
If the answer is not clearly supported by the provided knowledge, say so clearly and avoid inventing facts.
Be friendly, practical, and structured.
For HR, onboarding, safety, training, absence, and process questions, give concrete next steps.
Use short paragraphs and simple bullet points where useful.
Do not use markdown headings like # or ##.
Do not describe your general capabilities unless the user asks.`
        : `Du bist NoRFood Buddy, ein warmer und praktischer Onboarding-Assistent für Mitarbeitende von NoRFood.
Antworte auf Deutsch.
Nutze den bereitgestellten Wissenskontext, wenn er relevant ist.
Wenn der Wissenskontext die Antwort enthält, priorisiere ihn.
Wenn die Antwort nicht klar durch den Wissenskontext gestützt ist, sage das offen und erfinde nichts.
Sei freundlich, praktisch und strukturiert.
Bei Fragen zu HR, Onboarding, Sicherheit, Schulungen, Abwesenheit und Prozessen nenne konkrete nächste Schritte.
Verwende kurze Absätze und bei Bedarf einfache Aufzählungen.
Verwende keine Markdown-Überschriften wie # oder ##.
Erkläre nicht allgemein, was du alles kannst, außer die Person fragt direkt danach.`;

    const userContent = needleContext
      ? `Wissenskontext:
${needleContext}

Nutzerfrage:
${message}`
      : message;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 900,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userContent
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

    const reply = data?.content?.[0]?.text || 'Keine Antwort erhalten.';

    return res.status(200).json({
      reply,
      usedKnowledge: Boolean(needleContext)
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Server error',
      details: error.message
    });
  }
}
