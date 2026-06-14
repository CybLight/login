export function isLocalDevHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

export function resolveClientWebAuthnRpId(serverRpId?: string): string {
  const { hostname } = window.location;
  if (isLocalDevHostname(hostname)) {
    return hostname;
  }
  return serverRpId || hostname;
}
