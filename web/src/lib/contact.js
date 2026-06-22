// Helpers for building WhatsApp / email contact links from the site profile.

export function digitsOnly(value) {
  return (value || "").replace(/\D/g, "");
}

export function whatsappLink(phone, message) {
  const number = digitsOnly(phone);
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export function mailtoLink(email, subject, body) {
  if (!email) return null;
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
