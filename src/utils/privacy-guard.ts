export function allowsFunctionalConsent(): boolean {
  return Boolean(window.CybPrivacy?.allows('functional'));
}

export function allowsDiagnosticConsent(): boolean {
  return Boolean(window.CybPrivacy?.allows('diagnostic'));
}

export function allowsUsageConsent(): boolean {
  return Boolean(window.CybPrivacy?.allows('usage'));
}
