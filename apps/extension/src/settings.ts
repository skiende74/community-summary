import { summaryToneSchema, type SummaryTone } from '@summary/contracts';
export type Settings = { enabled: boolean; expanded: boolean; tone: SummaryTone | 'default' };
export const defaults: Settings = { enabled: true, expanded: true, tone: 'default' };
export async function readSettings(): Promise<Settings> {
  const values = await chrome.storage.local.get(defaults);
  return {
    enabled: typeof values.enabled === 'boolean' ? values.enabled : true,
    expanded: typeof values.expanded === 'boolean' ? values.expanded : true,
    tone: summaryToneSchema.safeParse(values.tone).data ?? 'default',
  };
}
