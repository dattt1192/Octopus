/** Display timestamps as YYYY/MM/DD HH:mm:ss in the device's local timezone. */
export function formatDateTime(value: string | number): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return typeof value === "string" ? value : "unknown time";
  const pad = (part: number) => String(part).padStart(2, "0");
  const day = `${String(date.getFullYear()).padStart(4, "0")}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
  return `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
