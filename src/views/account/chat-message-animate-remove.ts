const MESSAGE_REMOVE_ANIM_MS = 280;

export function animateChatMessageRemoval(
  container: HTMLElement | null | undefined,
  messageId: string,
): Promise<boolean> {
  if (!container || !messageId) return Promise.resolve(false);

  const el = container.querySelector<HTMLElement>(
    `[data-message-id="${CSS.escape(messageId)}"]`,
  );
  if (!el) return Promise.resolve(false);

  const height = el.offsetHeight;
  el.style.height = `${height}px`;
  el.style.overflow = 'hidden';

  return new Promise((resolve) => {
    let settled = false;
    const finish = (removed: boolean) => {
      if (settled) return;
      settled = true;
      resolve(removed);
    };

    const onEnd = (event: TransitionEvent) => {
      if (event.target !== el) return;
      if (event.propertyName !== 'height' && event.propertyName !== 'opacity') return;
      el.removeEventListener('transitionend', onEnd);
      if (el.isConnected) el.remove();
      finish(true);
    };

    el.addEventListener('transitionend', onEnd);
    requestAnimationFrame(() => {
      el.classList.add('chat-message--removing');
    });

    window.setTimeout(() => {
      el.removeEventListener('transitionend', onEnd);
      if (el.isConnected) el.remove();
      finish(true);
    }, MESSAGE_REMOVE_ANIM_MS + 80);
  });
}
