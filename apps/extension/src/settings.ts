export type Settings = { enabled: boolean; expanded: boolean };
export const defaults: Settings = { enabled: true, expanded: true };
export async function readSettings(): Promise<Settings> {
  const values = await chrome.storage.local.get(defaults);
  return {
    enabled: typeof values.enabled === 'boolean' ? values.enabled : true,
    expanded: typeof values.expanded === 'boolean' ? values.expanded : true,
  };
}
