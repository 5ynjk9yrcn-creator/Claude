import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function summarise(text) {
  const completion = await client.chat.completions.create({
    model: 'gpt-4-turbo',
    messages: [{ role: 'user', content: text }]
  });
  return completion.choices[0].message.content;
}

export async function embed(input) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'text-embedding-ada-002', input })
  });
  return res.json();
}
