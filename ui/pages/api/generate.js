// API route: POST /api/generate
// Body: { starRating, reviewText, language }
// Returns: { reply }

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Load guidelines from repo root (one level up from /ui)
const guidelinesPath = path.join(process.cwd(), '..', 'tone-of-voice-guidelines.md');
let guidelines;
try {
  guidelines = fs.readFileSync(guidelinesPath, 'utf8');
} catch {
  // Fallback: look in same directory (for Vercel deployment where files are copied)
  guidelines = fs.readFileSync(path.join(process.cwd(), 'tone-of-voice-guidelines.md'), 'utf8');
}

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

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.7,
      max_tokens: 200
    });

    const reply = response.choices[0].message.content.trim();
    res.status(200).json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
