/**
 * Пасхалка «Зеркало профиля» — 7 быстрых кликов по своему аватару на странице профиля.
 */

import { apiCall, getStorage, setStorage, maybeLogBridgeEaster, sendEasterLog } from "@/utils";
import { PROFILE_MIRROR_KEY } from "@/config/constants";
import { authService, extractEasterFlags } from "@/services";

const CLICKS_REQUIRED = 7;
const CLICK_WINDOW_MS = 4200;

let clickCount = 0;
let clickTimer: ReturnType<typeof setTimeout> | null = null;
let isUnlocking = false;

export function hasProfileMirrorAccess(): boolean {
  return getStorage(PROFILE_MIRROR_KEY) === "1";
}

export function setProfileMirrorAccess(): void {
  setStorage(PROFILE_MIRROR_KEY, "1");
}

function resetClickCounter(): void {
  clickCount = 0;
  if (clickTimer) {
    clearTimeout(clickTimer);
    clickTimer = null;
  }
}

function spawnMirrorBurst(anchor: HTMLElement): void {
  const rect = anchor.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const symbols = ["🪞", "✨", "◇", "◆"];

  for (let i = 0; i < 14; i++) {
    const particle = document.createElement("span");
    particle.className = "profile-mirror-particle";
    particle.textContent = symbols[i % symbols.length];
    particle.style.left = `${cx}px`;
    particle.style.top = `${cy}px`;
    const angle = (Math.PI * 2 * i) / 14;
    const dist = 48 + Math.random() * 72;
    particle.style.setProperty("--mx", `${Math.cos(angle) * dist}px`);
    particle.style.setProperty("--my", `${Math.sin(angle) * dist}px`);
    document.body.appendChild(particle);
    particle.addEventListener("animationend", () => particle.remove(), {
      once: true,
    });
  }
}

function showMirrorModal(username: string): Promise<void> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "profile-mirror-overlay";
    overlay.innerHTML = `
      <div class="profile-mirror-modal" role="dialog" aria-modal="true" aria-labelledby="profileMirrorTitle">
        <div class="profile-mirror-modal__glow" aria-hidden="true"></div>
        <div class="profile-mirror-modal__icon" aria-hidden="true">🪞</div>
        <h2 id="profileMirrorTitle" class="profile-mirror-modal__title">Зеркало профиля</h2>
        <p class="profile-mirror-modal__text">
          Семь отражений — и ты увидел себя с другой стороны.
          <br> Поздравляем!
          <strong>${username}</strong>, ты получил отражение в копилку пасхалок.
        </p>
        <button type="button" class="profile-mirror-modal__btn" id="profileMirrorClose">
          Красиво ✦
        </button>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("is-visible"));

    const close = () => {
      overlay.classList.remove("is-visible");
      overlay.addEventListener(
        "transitionend",
        () => {
          overlay.remove();
          resolve();
        },
        { once: true },
      );
      setTimeout(() => {
        if (overlay.isConnected) {
          overlay.remove();
          resolve();
        }
      }, 320);
    };

    overlay
      .querySelector("#profileMirrorClose")
      ?.addEventListener("click", close);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close();
    });
  });
}

async function logProfileMirrorUnlock(username: string): Promise<void> {
  try {
    const user = await authService.checkSession();
    const hadBridge = user?.easter?.bridge === true;

    sendEasterLog({
      type: "profile_mirror",
      userName: username,
      source: "profile_avatar_seven_clicks",
      alex: 3,
      clicks: CLICKS_REQUIRED,
    });

    const meRes = await apiCall("/auth/me", {
      method: "GET",
      credentials: "include",
    });
    if (!meRes.ok) return;

    const meData = await meRes.json().catch(() => ({}));
    maybeLogBridgeEaster(
      username,
      hadBridge,
      extractEasterFlags(meData).bridge === true,
    );
  } catch {
    // fire-and-forget
  }
}

async function saveProfileMirrorToServer(): Promise<void> {
  try {
    const response = await apiCall("/auth/easter/profile-mirror", {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) {
      console.warn("[MIRROR] Server save failed, kept locally");
    }
  } catch (error) {
    console.warn("[MIRROR] Server save error:", error);
  }
}

async function triggerProfileMirrorEaster(
  avatarEl: HTMLElement,
  username: string,
): Promise<void> {
  if (isUnlocking || hasProfileMirrorAccess()) return;

  isUnlocking = true;
  resetClickCounter();

  const header = avatarEl.closest(".profile-header");
  header?.classList.add("profile-mirror-flip");

  document.body.classList.add("profile-mirror-active");
  spawnMirrorBurst(avatarEl);

  await new Promise((r) => setTimeout(r, 900));

  setProfileMirrorAccess();
  await saveProfileMirrorToServer();
  void logProfileMirrorUnlock(username);
  await showMirrorModal(username);

  header?.classList.remove("profile-mirror-flip");
  document.body.classList.remove("profile-mirror-active");
  isUnlocking = false;
}

function pulseAvatarRing(avatarEl: HTMLElement, step: number): void {
  avatarEl.classList.remove("profile-avatar-pulse");
  void avatarEl.offsetWidth;
  avatarEl.classList.add("profile-avatar-pulse");
  avatarEl.style.setProperty("--mirror-step", String(step));

  const ring = document.createElement("span");
  ring.className = "profile-avatar-ring";
  ring.style.setProperty("--mirror-step", String(step));
  avatarEl.appendChild(ring);
  ring.addEventListener("animationend", () => ring.remove(), { once: true });
}

export function bindProfileMirrorEaster(
  avatarEl: HTMLElement | null,
  options: { username: string; enabled: boolean },
): void {
  if (!avatarEl || !options.enabled) return;

  avatarEl.classList.add("profile-avatar--easter");
  avatarEl.setAttribute("title", "");

  avatarEl.addEventListener("click", () => {
    if (isUnlocking) return;

    if (hasProfileMirrorAccess()) {
      avatarEl.classList.remove("profile-avatar--found");
      void avatarEl.offsetWidth;
      avatarEl.classList.add("profile-avatar--found");
      setTimeout(() => avatarEl.classList.remove("profile-avatar--found"), 860);
      return;
    }

    clickCount += 1;
    pulseAvatarRing(avatarEl, clickCount);

    if (clickTimer) clearTimeout(clickTimer);
    clickTimer = setTimeout(resetClickCounter, CLICK_WINDOW_MS);

    if (clickCount >= CLICKS_REQUIRED) {
      void triggerProfileMirrorEaster(avatarEl, options.username);
    }
  });
}
