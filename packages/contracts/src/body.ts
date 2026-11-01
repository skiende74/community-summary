export const bodyLimit = 600;
const omission = '\n(중략하였음)\n';

export function shortenBody(value: string): string {
  const text = value.trim();
  const chars = Array.from(text);
  const half = bodyLimit / 2;
  if (chars.length <= bodyLimit || (chars.length === bodyLimit + omission.length
    && chars.slice(half, half + omission.length).join('') === omission)) return text;
  return chars.slice(0, half).join('') + omission + chars.slice(-half).join('');
}
