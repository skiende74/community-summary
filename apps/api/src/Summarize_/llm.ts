import OpenAI from 'openai';
import { responseSchema, type SummaryRequest } from '@summary/contracts';
import { summaryInstructions, model } from './prompt.js';

export async function summarize(input: SummaryRequest) {
  const client = new OpenAI({ timeout: 22_000, maxRetries: 0 });
  const { tone = 'haeyo', ...content } = input;
  const response = await client.responses.create({
    model, reasoning: { effort: 'low' }, instructions: summaryInstructions(tone),
    input: JSON.stringify(content), max_output_tokens: 2048, store: false,
  });
  if (response.status !== 'completed') throw new Error('Incomplete response');
  return responseSchema.parse({
    summary: response.output_text.trim(), count: input.comments.length,
  });
}
