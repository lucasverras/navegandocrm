// Cleans a phone number into E.164-ish digits and builds a wa.me link.
export function buildWhatsAppLink(rawPhone: string, message: string): string | null {
  const digits = rawPhone.replace(/\D/g, "");
  if (digits.length < 8) return null;

  let normalized = digits;
  // Add BR country code (55) if missing.
  if (!normalized.startsWith("55")) {
    normalized = `55${normalized}`;
  }

  const encoded = encodeURIComponent(message);
  return `https://wa.me/${normalized}?text=${encoded}`;
}

export function isValidBrazilianPhone(rawPhone: string): boolean {
  const digits = rawPhone.replace(/\D/g, "");
  // 10-11 local digits, or 12-13 with country code.
  return digits.length >= 10 && digits.length <= 13;
}
