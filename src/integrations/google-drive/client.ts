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

function buildBackupFilesQuery(userId: string): string {
  return [
    "appProperties has { key='cyblightBackup' and value='1' }",
    `appProperties has { key='cyblightUserId' and value='${escapeDriveQueryValue(userId)}' }`,
    'trashed = false',
  ].join(' and ');
}

/** Lists CybLight backups for the account (web + app), newest first. */
export async function listDriveBackupFiles(
  accessToken: string,
  userId: string,
): Promise<DriveBackupFile[]> {
  const url = new URL(`${GOOGLE_DRIVE_API_BASE}/files`);
  url.searchParams.set('q', buildBackupFilesQuery(userId));
  url.searchParams.set('fields', 'files(id,name,modifiedTime,size)');
  url.searchParams.set('orderBy', 'modifiedTime desc');
  url.searchParams.set('pageSize', '50');

  const response = await driveFetch(accessToken, url.toString());
  if (!response.ok) {
    throw new Error('google_drive_list_failed');
  }

  const data = (await response.json()) as DriveListResponse;
  return data.files ?? [];
}

export async function findDriveBackupFile(
  accessToken: string,
  userId: string,
): Promise<DriveBackupFile | null> {
  const files = await listDriveBackupFiles(accessToken, userId);
  return files[0] ?? null;
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

async function deleteDriveBackupFileById(accessToken: string, fileId: string): Promise<boolean> {
  const response = await driveFetch(
    accessToken,
    `${GOOGLE_DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}`,
    { method: 'DELETE' },
  );

  if (response.status === 403 || response.status === 404) {
    return false;
  }
  if (!response.ok) {
    throw new Error('google_drive_delete_failed');
  }
  return true;
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
  const files = await listDriveBackupFiles(accessToken, userId);
  if (files.length === 0) return false;

  let deletedAny = false;
  for (const file of files) {
    if (await deleteDriveBackupFileById(accessToken, file.id)) {
      deletedAny = true;
    }
  }
  return deletedAny;
}

export type GoogleDriveStorageQuota = {
  usageBytes: number;
  limitBytes?: number;
};

type DriveAboutResponse = {
  storageQuota?: {
    limit?: string;
    usage?: string;
  };
};

export async function fetchDriveStorageQuota(
  accessToken: string,
): Promise<GoogleDriveStorageQuota | null> {
  try {
    const url = `${GOOGLE_DRIVE_API_BASE}/about?fields=${encodeURIComponent('storageQuota(limit,usage)')}`;
    const response = await driveFetch(accessToken, url);
    if (!response.ok) return null;
    const data = (await response.json()) as DriveAboutResponse;
    const quota = data.storageQuota;
    if (!quota?.usage) return null;
    const usageBytes = Number(quota.usage);
    if (isNaN(usageBytes)) return null;
    const limitNum = quota.limit ? Number(quota.limit) : 0;
    const limitBytes = limitNum > 0 ? limitNum : undefined;
    return { usageBytes, limitBytes };
  } catch {
    return null;
  }
}
