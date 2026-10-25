/** UUIDs used as stock-operation identifiers also work on public HTTP origins. */
export function createRequestId(): string {
  if (typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Clipboard API requires HTTPS; the selected-text fallback supports HTTP. */
export async function copyText(text: string): Promise<void> {
  if (globalThis.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      /* use fallback */
    }
  }
  const previous = document.activeElement as HTMLElement | null;
  const field = document.createElement("textarea");
  field.value = text;
  field.readOnly = true;
  field.style.cssText = "position:fixed;left:-9999px;top:0";
  field.setAttribute("aria-hidden", "true");
  document.body.append(field);
  field.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } finally {
    field.remove();
    previous?.focus();
  }
  if (!copied) throw new Error("浏览器限制了自动复制，请选中文字手动复制。");
}
