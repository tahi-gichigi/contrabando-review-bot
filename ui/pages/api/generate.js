// API route: POST /api/generate
// Body: { starRating, reviewText, language }
// Returns: { reply }

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Guidelines file is co-located in the ui/ directory
const guidelinesPath = path.join(process.cwd(), 'tone-of-voice-guidelines.md');
const guidelines = fs.readFileSync(guidelinesPath, 'utf8');

const SYSTEM_PROMPT = `${guidelines}

---
IMPORTANT: Return only the reply text. No quotes, no label, no explanation. Just the reply.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { starRating, reviewText, language } = req.body;

  if (!starRating) return res.status(400).json({ error: 'starRating is required' });

  try {
    const userMessage = `Star rating: ${starRating}
Review text: ${reviewText || '(no comment)'}
Reviewer language: ${language || 'PT'}`;

    const response = await client.responses.create({
      model: 'gpt-5-mini',
      instructions: SYSTEM_PROMPT,
      input: userMessage,
      reasoning: { effort: 'minimal' }
    });

    const reply = response.output_text.trim();
    res.status(200).json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
