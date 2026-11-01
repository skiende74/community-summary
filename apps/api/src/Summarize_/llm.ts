import OpenAI from 'openai';
import { responseSchema, type SummaryRequest } from '@summary/contracts';
import { instructions, model } from './prompt.js';

export async function summarize(input: SummaryRequest) {
  const client = new OpenAI({ timeout: 22_000, maxRetries: 0 });
  const response = await client.responses.create({
    model, reasoning: { effort: 'low' }, instructions,
    input: JSON.stringify(input), max_output_tokens: 2048, store: false,
  });
  if (response.status !== 'completed') throw new Error('Incomplete response');
  return responseSchema.parse({
    summary: response.output_text.trim(), count: input.comments.length,
  });
}
