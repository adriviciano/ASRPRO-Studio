export function detectLanguage(locale: string): 'es' | 'en' {
  return /^es(?:-|$)/i.test(locale) ? 'es' : 'en';
}
