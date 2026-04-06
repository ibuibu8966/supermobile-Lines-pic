/**
 * 日本時間（JST / UTC+9）の現在日時を取得する
 */
export function getNowJST(): Date {
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const utc = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  return new Date(utc + jstOffset);
}
