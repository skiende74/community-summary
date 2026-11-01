export const consentKey = 'dataConsent:v1';
export async function hasConsent() {
  return (await chrome.storage.local.get(consentKey))[consentKey] === true;
}
export async function requireConsent() {
  if (!await hasConsent()) throw new Error('확장 프로그램에서 데이터 전송 안내에 동의한 뒤 사용해 주세요.');
}
