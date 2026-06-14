import { decryptMessageList, getSignalUserId } from '@/crypto/signal';
import { stripNoPreviewTokens, truncatePreviewText } from './chat-format';
import type { ConversationPreviewEntry, ConversationPreviewWireMessage } from './unread';

const previewCache = new Map<
  string,
  { text: string; senderId: string; latestAt: number }
>();

function formatConversationPreview(userId: string, senderId: string, text: string): string {
  const preview = truncatePreviewText(stripNoPreviewTokens(text));
  return senderId === userId ? `Вы: ${preview}` : preview;
}

export function cacheConversationPreview(
  friendId: string,
  senderId: string,
  text: string,
  latestAt: number,
): void {
  if (!friendId || !text.trim()) return;
  const existing = previewCache.get(friendId);
  if (existing && existing.latestAt > latestAt) return;
  previewCache.set(friendId, { text, senderId, latestAt });
}

export async function enrichConversationPreviews(
  previews: Record<string, ConversationPreviewEntry>,
  userId = getSignalUserId(),
): Promise<Record<string, ConversationPreviewEntry>> {
  if (!userId) return previews;

  const entries = Object.entries(previews);
  if (entries.length === 0) return previews;

  const next: Record<string, ConversationPreviewEntry> = { ...previews };
  const pending: Array<{
    friendId: string;
    entry: ConversationPreviewEntry;
    wire: ConversationPreviewWireMessage;
  }> = [];

  for (const [friendId, entry] of entries) {
    const cached = previewCache.get(friendId);
    if (cached && cached.latestAt >= Number(entry.latestAt || 0)) {
      next[friendId] = {
        ...entry,
        preview: formatConversationPreview(userId, cached.senderId, cached.text),
      };
      continue;
    }

    const wire = entry.lastMessage;
    if (!wire || wire.encryption !== 'signal_v1') continue;

    pending.push({ friendId, entry, wire });
  }

  if (pending.length === 0) return next;

  const decrypted = await decryptMessageList(
    userId,
    pending.map(({ wire }) => ({
      id: wire.id,
      content: wire.content,
      senderId: wire.senderId,
      encryption: wire.encryption,
      signalType: wire.signalType,
      registrationId: wire.registrationId,
      createdAt: wire.createdAt ?? null,
    })),
  );

  pending.forEach(({ friendId, entry, wire }, index) => {
    const text = decrypted[index]?.content;
    if (!text) return;
    next[friendId] = {
      ...entry,
      preview: formatConversationPreview(userId, wire.senderId, text),
    };
    cacheConversationPreview(friendId, wire.senderId, text, Number(entry.latestAt || 0));
  });

  return next;
}
