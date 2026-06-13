import type { UnreadMapRow } from '@/types';
import { apiCall } from '@/utils';

export type ConversationPreviewEntry = {
  preview: string;
  latestAt: number;
  kind?: 'message' | 'reaction';
};

export type UnreadSummary = {
  totalPending: number;
  totalUnread: number;
  unreadByUser: Record<string, number>;
  conversationPreviews: Record<string, ConversationPreviewEntry>;
};

export function setNavBadge(type: 'pending-requests' | 'unread-messages', count: number): void {
  const normalizedCount = Number(count || 0);
  document.querySelectorAll(`[data-badge-type="${type}"]`).forEach((badge) => {
    const element = badge as HTMLElement;
    if (normalizedCount > 0) {
      element.textContent = String(normalizedCount);
      element.style.display = 'inline-flex';
    } else {
      element.style.display = 'none';
    }
  });
}

export async function fetchUnreadSummaryData(): Promise<UnreadSummary | null> {
  console.log('[fetchUnreadSummaryData] Starting...');
  const endpoints = ['/messages/unread-summary'];

  for (const endpoint of endpoints) {
    try {
      console.log('[fetchUnreadSummaryData] Trying endpoint:', endpoint);
      const response = await apiCall(endpoint, {
        method: 'GET',
        credentials: 'include',
      });

      console.log('[fetchUnreadSummaryData] Response status:', response.status, 'ok:', response.ok);

      if (!response.ok) {
        console.warn('[fetchUnreadSummaryData] Response not ok, status:', response.status);
        continue;
      }

      let payload: Record<string, unknown> = {};
      try {
        payload = await response.json();
        console.log('[fetchUnreadSummaryData] Full payload:', JSON.stringify(payload, null, 2));
      } catch (parseErr) {
        console.error('[fetchUnreadSummaryData] JSON parse error:', parseErr);
        continue;
      }

      const data = (
        payload?.data && typeof payload.data === 'object' ? payload.data : payload
      ) as Record<string, unknown>;
      console.log('[fetchUnreadSummaryData] Extracted data:', JSON.stringify(data, null, 2));

      const rawUnreadMap =
        data?.unreadByUser ??
        data?.unread_by_user ??
        data?.unreadBySender ??
        data?.unread_by_sender ??
        {};

      console.log('[fetchUnreadSummaryData] Raw unread map:', rawUnreadMap);

      const unreadByUser: Record<string, number> = Array.isArray(rawUnreadMap)
        ? Object.fromEntries(
            rawUnreadMap.map((row: UnreadMapRow) => [
              String(row?.sender_id ?? row?.senderId ?? row?.user_id ?? row?.userId ?? ''),
              Number(row?.unread_count ?? row?.unreadCount ?? row?.count ?? 0),
            ])
          )
        : (rawUnreadMap as Record<string, number>) || {};

      const totalPending = Number(
        data?.totalPending ?? data?.total_pending ?? data?.pendingCount ?? data?.pending_count ?? 0
      );
      const totalUnread = Number(
        data?.totalUnread ??
          data?.total_unread ??
          data?.unreadCount ??
          data?.unread_count ??
          Object.values(unreadByUser).reduce((sum, value) => sum + Number(value || 0), 0)
      );

      const rawConversationPreviews =
        data?.conversationPreviews ?? data?.conversation_previews ?? {};
      const conversationPreviews: Record<string, ConversationPreviewEntry> = {};

      if (rawConversationPreviews && typeof rawConversationPreviews === 'object') {
        Object.entries(rawConversationPreviews as Record<string, unknown>).forEach(
          ([friendId, value]) => {
            if (!value || typeof value !== 'object') return;
            const row = value as Record<string, unknown>;
            const preview = String(row.preview ?? row.text ?? '').trim();
            if (!preview) return;
            conversationPreviews[friendId] = {
              preview,
              latestAt: Number(row.latestAt ?? row.latest_at ?? 0),
              kind:
                row.kind === 'reaction' || row.kind === 'message'
                  ? row.kind
                  : undefined,
            };
          }
        );
      }

      console.log('[fetchUnreadSummaryData] Final result:', {
        totalPending,
        totalUnread,
        unreadByUser,
        conversationPreviews,
      });

      return { totalPending, totalUnread, unreadByUser, conversationPreviews };
    } catch (err) {
      console.error(
        '[fetchUnreadSummaryData] Unread summary request failed for endpoint:',
        endpoint,
        'Error:',
        err
      );
    }
  }

  console.warn('[fetchUnreadSummaryData] All endpoints failed, calling fallback');
  return fetchUnreadSummaryFallback();
}

export async function updateNavBadges(): Promise<void> {
  try {
    const summary = await fetchUnreadSummaryData();
    if (!summary) {
      return;
    }

    const totalPending = summary.totalPending;
    const totalUnread = summary.totalUnread;

    const pendingBadges = document.querySelectorAll('[data-badge-type="pending-requests"]');
    pendingBadges.forEach((badge) => {
      const pendingBadge = badge as HTMLElement;
      if (totalPending > 0) {
        pendingBadge.textContent = String(totalPending);
        pendingBadge.style.display = 'inline-flex';
      } else {
        pendingBadge.style.display = 'none';
      }
    });

    const unreadBadges = document.querySelectorAll('[data-badge-type="unread-messages"]');
    unreadBadges.forEach((badge) => {
      const unreadBadge = badge as HTMLElement;
      if (totalUnread > 0) {
        unreadBadge.textContent = String(totalUnread);
        unreadBadge.style.display = 'inline-flex';
      } else {
        unreadBadge.style.display = 'none';
      }
    });
  } catch (err) {
    console.error('[updateNavBadges] Error:', err);
  }
}

export async function updateChatUnreadBadges(): Promise<void> {
  try {
    const summary = await fetchUnreadSummaryData();
    if (!summary) {
      console.warn('Failed to fetch unread summary');
      return;
    }

    const unreadByUser = summary.unreadByUser;

    document.querySelectorAll('[data-unread-badge]').forEach((badge) => {
      const friendId = badge.getAttribute('data-unread-badge');
      if (!friendId) return;
      const count = Number(unreadByUser[friendId] || 0);

      if (count > 0) {
        badge.textContent = String(count);
        (badge as HTMLElement).style.display = 'inline-flex';
      } else {
        (badge as HTMLElement).style.display = 'none';
      }
    });
  } catch (err) {
    console.error('Error updating chat unread badges:', err);
  }
}

async function fetchUnreadSummaryFallback(): Promise<UnreadSummary | null> {
  try {
    const pendingRes = await apiCall('/friends/pending', { method: 'GET', credentials: 'include' });

    const pendingPayload = pendingRes.ok
      ? await pendingRes.json().catch(() => ({} as Record<string, unknown>))
      : {};
    const pendingData =
      pendingPayload?.data && typeof pendingPayload.data === 'object'
        ? pendingPayload.data
        : pendingPayload;
    const pendingRequests =
      (Array.isArray(pendingData?.pendingRequests) && pendingData.pendingRequests) ||
      (Array.isArray(pendingData?.pending_requests) && pendingData.pending_requests) ||
      [];
    const totalPending = Number(pendingRequests.length || 0);

    return { totalPending, totalUnread: 0, unreadByUser: {}, conversationPreviews: {} };
  } catch (err) {
    console.warn('Unread summary fallback failed:', err);
    return null;
  }
}
