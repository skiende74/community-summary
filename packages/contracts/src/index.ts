import { z } from 'zod';
export * from './rules.js';

export const limits = { comments: 300, comment: 2000, body: 6000, total: 60000 };
export const requestSchema = z.object({
  title: z.string().trim().min(1).max(500),
  body: z.string().max(limits.body),
  comments: z.array(z.object({
    id: z.string().regex(/^comment_\d+$/),
    text: z.string().trim().min(1).max(limits.comment),
    isReply: z.boolean(),
  })).min(1).max(limits.comments),
}).refine(value => value.comments.reduce((n, c) => n + c.text.length, 0) <= limits.total,
  '댓글 길이가 제한을 초과했습니다.');

export const responseSchema = z.object({
  summary: z.string().trim().min(1).max(2000)
    .refine(text => text.split('\n').filter(line => line.trim()).length <= 4),
  count: z.number().int().positive(),
});
export type SummaryRequest = z.infer<typeof requestSchema>;
export type SummaryResponse = z.infer<typeof responseSchema>;
