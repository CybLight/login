let currentUserId: string | null = null;

export function setSignalUserId(userId: string | null): void {
  currentUserId = userId;
}

export function getSignalUserId(): string {
  if (!currentUserId) {
    throw new Error('signal_user_missing');
  }
  return currentUserId;
}

export function tryGetSignalUserId(): string | null {
  return currentUserId;
}
