import { summaryToneSchema, type SummaryTone } from '@summary/contracts';

export const resolveTone = (tone?: SummaryTone): SummaryTone =>
  tone ?? summaryToneSchema.safeParse(process.env.SUMMARY_DEFAULT_TONE).data ?? 'haeyo';
