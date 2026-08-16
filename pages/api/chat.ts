import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

const fallbackReply = `
I don’t know, sorry. If you need assistance, you can select from the given options above.
`.trim();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { message } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ reply: fallbackReply });
  }

  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'openai/gpt-3.5-turbo',
        messages: [
          {
          role: 'system',
content: `
You are BankEase Bot — an AI assistant inside the BankEase app.

You help users with:
- Registration, login, and authentication
- Linking banks (Plaid)
- Sending money (Dwolla)
- Viewing balances and transactions
- General banking questions like: What is ACH, Plaid, Dwolla, bank transfer, etc.
- General greetings like: hi, hello, how are you

Do NOT answer completely unrelated things like politics, food, history, or jokes. If you don't know, say:

"I don’t know, sorry. If you need assistance, you can select from the given options above."

Be concise, polite, and helpful.
`.trim(),

          },
          {
            role: 'user',
            content: message.trim(),
          },
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        },
      }
    );

    const reply: string | undefined = response.data?.choices?.[0]?.message?.content?.trim();

    if (!reply || reply.length < 2) {
      return res.status(200).json({ reply: fallbackReply });
    }

    // Avoid false positives — only trigger fallback on empty or nonsense
    const cleaned = reply.toLowerCase();
    const irrelevantPhrases = [
      "i don't know",
      "i’m not sure",
      "i do not understand",
      "as an ai",
      "i cannot answer",
    ];

    const isClearlyUseless = irrelevantPhrases.some((phrase) => cleaned.includes(phrase));

    if (isClearlyUseless) {
      return res.status(200).json({ reply: fallbackReply });
    }

    return res.status(200).json({ reply });
  } catch (error: any) {
    console.error('❌ OpenRouter API error:', error.response?.data || error.message);
    return res.status(200).json({ reply: fallbackReply });
  }
}
