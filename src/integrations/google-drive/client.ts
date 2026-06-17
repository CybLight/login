import {
  buildDriveBackupFileName,
  GOOGLE_DRIVE_API_BASE,
  GOOGLE_DRIVE_UPLOAD_BASE,
} from './config';

export type DriveBackupFile = {
  id: string;
  name: string;
  modifiedTime: string;
  size?: string;
};

type DriveListResponse = {
  files?: DriveBackupFile[];
};

async function driveFetch(
  accessToken: string,
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers || {});
  headers.set('Authorization', `Bearer ${accessToken}`);
  return fetch(url, { ...init, headers });
}

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export async function findDriveBackupFile(
  accessToken: string,
  userId: string,
): Promise<DriveBackupFile | null> {
  const query = [
    "appProperties has { key='cyblightBackup' and value='1' }",
    `appProperties has { key='cyblightUserId' and value='${escapeDriveQueryValue(userId)}' }`,
    'trashed = false',
  ].join(' and ');

  const url = new URL(`${GOOGLE_DRIVE_API_BASE}/files`);
  url.searchParams.set('q', query);
  url.searchParams.set('fields', 'files(id,name,modifiedTime,size)');
  url.searchParams.set('orderBy', 'modifiedTime desc');
  url.searchParams.set('pageSize', '1');

  const response = await driveFetch(accessToken, url.toString());
  if (!response.ok) {
    throw new Error('google_drive_list_failed');
  }

  const data = (await response.json()) as DriveListResponse;
  return data.files?.[0] || null;
}

export async function downloadDriveBackupFile(
  accessToken: string,
  fileId: string,
): Promise<string> {
  const response = await driveFetch(
    accessToken,
    `${GOOGLE_DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?alt=media`,
  );
  if (!response.ok) {
    throw new Error('google_drive_download_failed');
  }
  return response.text();
}

export async function uploadDriveBackupFile(
  accessToken: string,
  userId: string,
  login: string,
  content: string,
): Promise<DriveBackupFile> {
  const existing = await findDriveBackupFile(accessToken, userId);

  if (existing) {
    const response = await driveFetch(
      accessToken,
      `${GOOGLE_DRIVE_UPLOAD_BASE}/files/${encodeURIComponent(existing.id)}?uploadType=media`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: content,
      },
    );
    if (!response.ok) {
      throw new Error('google_drive_upload_failed');
    }
    const updated = (await response.json()) as DriveBackupFile;
    return {
      id: updated.id || existing.id,
      name: updated.name || existing.name,
      modifiedTime: updated.modifiedTime || new Date().toISOString(),
      size: updated.size,
    };
  }

  const boundary = 'cyblight_backup_boundary';
  const metadata = {
    name: buildDriveBackupFileName(login),
    mimeType: 'application/json',
    appProperties: {
      cyblightBackup: '1',
      cyblightUserId: userId,
    },
  };

  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    content,
    `--${boundary}--`,
    '',
  ].join('\r\n');

  const response = await driveFetch(
    accessToken,
    `${GOOGLE_DRIVE_UPLOAD_BASE}/files?uploadType=multipart`,
    {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );

  if (!response.ok) {
    throw new Error('google_drive_upload_failed');
  }

  const created = (await response.json()) as DriveBackupFile;
  if (!created.id) {
    throw new Error('google_drive_upload_failed');
  }
  return created;
}

export async function deleteDriveBackupFile(accessToken: string, userId: string): Promise<boolean> {
  const existing = await findDriveBackupFile(accessToken, userId);
  if (!existing) return false;

  const response = await driveFetch(
    accessToken,
    `${GOOGLE_DRIVE_API_BASE}/files/${encodeURIComponent(existing.id)}`,
    { method: 'DELETE' },
  );

  if (!response.ok && response.status !== 404) {
    throw new Error('google_drive_delete_failed');
  }
  return true;
}
