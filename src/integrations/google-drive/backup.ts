import { createBackupFile, importBackupFile, type BackupRestoreResult } from '@/crypto/backup';
import { getGoogleDriveAccessToken } from './auth';
import {
  deleteDriveBackupFile,
  downloadDriveBackupFile,
  findDriveBackupFile,
  uploadDriveBackupFile,
  type DriveBackupFile,
} from './client';

export type DriveBackupMetadata = {
  file: DriveBackupFile;
};

export async function fetchDriveBackupMetadata(userId: string): Promise<DriveBackupMetadata | null> {
  let accessToken: string;
  try {
    accessToken = await getGoogleDriveAccessToken({ interactive: false });
  } catch {
    return null;
  }

  const file = await findDriveBackupFile(accessToken, userId);
  return file ? { file } : null;
}

export async function uploadBackupToGoogleDrive(
  userId: string,
  login: string,
  password: string,
  onProgress?: (percent: number) => void,
): Promise<DriveBackupFile> {
  const report = (percent: number): void => {
    onProgress?.(Math.min(100, Math.max(0, Math.round(percent))));
  };

  report(2);
  const accessToken = await getGoogleDriveAccessToken();
  report(10);
  const content = await createBackupFile(userId, password, { includeChats: true });
  report(48);
  const file = await uploadDriveBackupFile(accessToken, userId, login, content);
  report(100);
  return file;
}

export async function restoreBackupFromGoogleDrive(
  userId: string,
  password: string,
  onProgress?: (percent: number) => void,
): Promise<BackupRestoreResult> {
  const report = (percent: number): void => {
    onProgress?.(Math.min(100, Math.max(0, Math.round(percent))));
  };

  report(2);
  const accessToken = await getGoogleDriveAccessToken();
  report(10);
  const file = await findDriveBackupFile(accessToken, userId);
  if (!file) {
    throw new Error('google_drive_no_backup');
  }

  report(18);
  const raw = await downloadDriveBackupFile(accessToken, file.id);
  report(32);
  return importBackupFile(userId, raw, password, (restorePercent) => {
    report(32 + (restorePercent * 68) / 100);
  });
}

export async function deleteGoogleDriveBackup(userId: string): Promise<boolean> {
  const accessToken = await getGoogleDriveAccessToken();
  return deleteDriveBackupFile(accessToken, userId);
}
