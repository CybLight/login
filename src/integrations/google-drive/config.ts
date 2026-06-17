const env = ((import.meta as unknown) as { env?: Record<string, string | undefined> }).env || {};

export const GOOGLE_DRIVE_CLIENT_ID = String(env.VITE_GOOGLE_DRIVE_CLIENT_ID || '').trim();

export const GOOGLE_DRIVE_SCOPE = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ');

export const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

export const GOOGLE_GSI_SCRIPT_URL = 'https://accounts.google.com/gsi/client';

export const GOOGLE_DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';

export const GOOGLE_DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';

export function isGoogleDriveConfigured(): boolean {
  return GOOGLE_DRIVE_CLIENT_ID.length > 0;
}

export function buildDriveBackupFileName(login: string): string {
  const safeLogin = login.replace(/[^\w.-]+/g, '_') || 'user';
  return `cyblight-${safeLogin}.cyblight-backup`;
}
