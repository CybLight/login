import { t, getLocale, localeTag, sitePath } from '@/i18n';
import type { UserEasterFlags } from "@/types";
import { escapeHtml } from "@/utils";
import { getAvatarInnerHtml } from "./avatar";

type User = {
  id?: string;
  login?: string;
  username?: string;
  email?: string;
  avatar?: string;
  avatarUrl?: string;
  avatar_url?: string;
  emailVerified?: boolean;
  email_verified?: boolean | number | string;
  email_verified_at?: string;
  twoFactorEnabled?: boolean;
  totp_enabled?: boolean;
  totpEnabledAt?: string;
  role?: string;
  flags?: string[];
  createdAt?: number | string;
  publicId?: string;
  sessionsCount?: number;
  isBlocked?: boolean;
  password_changed_at?: number;
  passwordChangedAt?: number | string;
  passChangedAt?: number | string;
  pass_changed_at?: number | string;
  easter?: UserEasterFlags;
};

function isEmailVerified(user: User): boolean {
  return !!(
    user.emailVerified === true ||
    user.email_verified === true ||
    user.email_verified === 1 ||
    user.email_verified === "1" ||
    Boolean(user.email_verified_at)
  );
}

function formatDate(timestamp: string | number | null | undefined): string {
  if (!timestamp) return "—";
  const n = Number(timestamp);
  if (!Number.isFinite(n)) return "—";

  const ts = n > 10000000000 ? n : n * 1000;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";

  return d.toLocaleString(localeTag(getLocale()), {
    year: "numeric",
    month: "long",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Получить статус и бейджи пользователя
 */
export function getUserStatus(user: User): {
  main: { label: string; cls: string };
  badges: Array<{ label: string; cls: string; title?: string }>;
} {
  if (user.isBlocked || user.flags?.includes("banned")) {
    return {
      main: { label: t("Заблокирован"), cls: "status--blocked" },
      badges: [],
    };
  }

  const userRole = user.role?.toLowerCase();

  if (userRole === "owner" || user.flags?.includes("owner")) {
    return {
      main: { label: t("Владелец"), cls: "status--owner" },
      badges: buildBadges(user, { includeRoleBadges: false }),
    };
  }
  if (userRole === "admin" || user.flags?.includes("admin")) {
    return {
      main: { label: t("Администратор"), cls: "status--admin" },
      badges: buildBadges(user, { includeRoleBadges: false }),
    };
  }
  if (userRole === "moderator" || user.flags?.includes("moderator")) {
    return {
      main: { label: t("Модератор"), cls: "status--mod" },
      badges: buildBadges(user, { includeRoleBadges: false }),
    };
  }
  if (userRole === "support" || user.flags?.includes("support")) {
    return {
      main: { label: t("Поддержка"), cls: "status--support" },
      badges: buildBadges(user, { includeRoleBadges: false }),
    };
  }
  if (userRole === "registrar" || user.flags?.includes("registrar")) {
    return {
      main: { label: t("Регистратор"), cls: "status--registrar" },
      badges: buildBadges(user, { includeRoleBadges: false }),
    };
  }
  if (userRole === "tester" || user.flags?.includes("tester")) {
    return {
      main: { label: t("Тестер"), cls: "status--tester" },
      badges: buildBadges(user, { includeRoleBadges: false }),
    };
  }

  const createdAtMs =
    typeof user.createdAt === "string"
      ? parseInt(user.createdAt, 10)
      : user.createdAt || 0;
  const days = createdAtMs
    ? Math.floor((Date.now() - createdAtMs) / 86400000)
    : 0;
  const sessionsCount = user.sessionsCount || 0;

  let main;
  if (days < 7 || sessionsCount < 3) {
    main = { label: t("Новичок"), cls: "status--newbie" };
  } else if (days < 30 || sessionsCount < 20) {
    main = { label: t("Активный"), cls: "status--active" };
  } else if (days < 180 || sessionsCount < 80) {
    main = { label: t("Постоянный"), cls: "status--regular" };
  } else {
    main = { label: t("Ветеран"), cls: "status--veteran" };
  }

  return { main, badges: buildBadges(user) };
}

function buildBadges(
  user: User,
  opts: { includeRoleBadges?: boolean } = {},
): Array<{ label: string; cls: string; title?: string }> {
  const includeRoleBadges = opts.includeRoleBadges !== false;
  const flags = new Set(user.flags || []);
  const badges: Array<{ label: string; cls: string; title?: string }> = [];

  if (flags.has("dev") || flags.has("developer")) {
    badges.push({ label: "DEV", cls: "badge--dev" });
  }

  if (flags.has("premium") || flags.has("sponsor")) {
    badges.push({ label: "★", cls: "badge--premium", title: "Premium" });
  }

  if (flags.has("helper") || flags.has("contributor")) {
    badges.push({ label: "Helper", cls: "badge--info" });
  }

  if (includeRoleBadges && user.role) {
    const role = user.role.toLowerCase();
    if (role === "owner")
      badges.push({ label: t("• Владелец"), cls: "badge--owner" });
    if (role === "admin")
      badges.push({ label: t("• Администратор"), cls: "badge--admin" });
    if (role === "moderator")
      badges.push({ label: t("• Модератор"), cls: "badge--mod" });
    if (role === "support")
      badges.push({ label: t("• Поддержка"), cls: "badge--support" });
    if (role === "registrar")
      badges.push({ label: t("• Регистратор"), cls: "badge--registrar" });
    if (role === "tester")
      badges.push({ label: t("• Тестер"), cls: "badge--tester" });
  }

  if (flags.has("trusted")) badges.push({ label: "Trusted", cls: "badge--ok" });
  if (flags.has("beta")) badges.push({ label: "Beta", cls: "badge--beta" });

  return badges;
}

export function formatPublicId(publicId?: string): string {
  if (!publicId) return "—";
  const n = Number(publicId);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `CYB - ${n}`;
}

function renderProfileTab(user: User): string {
  const login = user.login || user.username || "User";
  const avatarSource = user.avatar || user.avatarUrl || user.avatar_url;
  const avatarInnerHtml = getAvatarInnerHtml(avatarSource, login);
  const emailVerified = isEmailVerified(user);
  const pubId = formatPublicId(user.publicId);
  const createdAt = formatDate(user.createdAt) || "—";

  const status = getUserStatus(user);
  const statusHtml = `<span class="chip status ${status.main.cls}" title="${t('Статус аккаунта')}"><span class="dot"></span> ${status.main.label}</span>`;
  const badgesHtml =
    status.badges.length > 0
      ? `<span class="badges">${status.badges.map((b) => `<span class="chip badge ${b.cls}" ${b.title ? `title="${b.title}"` : ""}>${b.label}</span>`).join("")}</span>`
      : "";

  const verifiedSvg = emailVerified
    ? `<span class="verified-badge" title="${t('Email подтверждён')}">
        <svg class="verified-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" fill="#3b82f6"/>
          <path d="M9 12l2 2 4-4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>`
    : "";

  return `
    <section class="profile-hero">
      <div class="profile-hero__left">
        <div class="profile-avatar" id="accountProfileAvatar" aria-hidden="true">
          ${avatarInnerHtml}
        </div>
        <div class="profile-hero__meta">
          <div class="profile-hero__title">
            <h2 class="profile-name">
              ${escapeHtml(login)}
            </h2>
            ${verifiedSvg}
          </div>
          <div class="profile-hero__chips-row">
            ${statusHtml}
            ${badgesHtml}
          </div>
        </div>
      </div>
      <div class="profile-hero__right profile-hero__right--stacked">
        <button type="button" data-route="${escapeHtml(login)}" 
                class="profile-action-btn profile-link-btn"
                title="${t('Посмотреть профиль')}" aria-label="${t('Посмотреть профиль')}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        </button>
        <button type="button" data-route="edit-profile" 
          class="profile-action-btn profile-edit-btn"
                title="${t('Редактировать профиль')}" aria-label="${t('Редактировать профиль')}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
      </div>
    </section>

    <section class="card-grid">
      <article class="info-card">
        <div class="info-card__label">${t('Логин')}</div>
        <div class="info-card__value">${escapeHtml(login)}</div>
        <div class="info-card__hint">${t('Основное имя для входа')}</div>
      </article>

      <article class="info-card">
        <div class="info-card__label">${t('ID пользователя')}</div>
        <div class="info-card__value">
          <span class="mono-pill id-pill">
            <b class="mono">${escapeHtml(pubId)}</b>
            ${
              user.publicId
                ? `<button class="copy-btn copy-btn--icon"
                      type="button"
                      data-copybtn="${escapeHtml(pubId)}"
                      aria-label="${t('Скопировать ID пользователя')}"
                      title="${t('Скопировать')}">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="currentColor" d="M16 1H6a2 2 0 0 0-2 2v12h2V3h10V1zm3 4H10a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H10V7h9v14z"/>
                    </svg>
                  </button>`
                : ""
            }
          </span>
        </div>
        <div class="info-card__hint">${t('Отправляй его поддержке')}</div>
      </article>

      <article class="info-card">
        <div class="info-card__label">${t('Дата регистрации')}</div>
        <div class="info-card__value">${escapeHtml(createdAt)}</div>
        <div class="info-card__hint">${t('Создано в системе')}</div>
      </article>
    </section>
  `;
}

function renderSecurityTab(user: User): string {
  const emailVerified = isEmailVerified(user);
  const emailText = user.email ? escapeHtml(user.email) : "—";
  const emailBadgeLabel = emailVerified
    ? t('Подтверждён')
    : user.email
      ? t('Не подтверждён')
      : "—";
  const emailBadge = emailVerified
    ? `<span class="sec-badge sec-badge--ok">${emailBadgeLabel}</span>`
    : user.email
      ? `<span class="sec-badge sec-badge--warn">${emailBadgeLabel}</span>`
      : `<span class="sec-badge">${emailBadgeLabel}</span>`;

  const emailStatus = emailVerified
    ? t('✅ Email подтверждён')
    : user.email
      ? t('⚠️ Email не подтверждён')
      : t('Email не указан');

  const passChanged =
    user.password_changed_at ||
    user.passwordChangedAt ||
    user.passChangedAt ||
    user.pass_changed_at ||
    null;
  const passChangedText = passChanged ? formatDate(passChanged) : "—";

  let securityScore = 0;
  const securityChecks: Array<{
    done: boolean;
    text: string;
    icon: string;
    id?: string;
  }> = [];

  if (emailVerified) {
    securityScore += 30;
    securityChecks.push({ done: true, text: t('Email подтвержден'), icon: "✅" });
  } else {
    securityChecks.push({
      done: false,
      text: t('Подтвердите email адрес'),
      icon: "⚠️",
    });
  }

  securityChecks.push({
    done: false,
    text: t('Включите двухфакторную аутентификацию'),
    icon: "🔐",
    id: "2fa-check",
  });
  securityChecks.push({
    done: false,
    text: t('Добавьте ключ доступа (Passkey)'),
    icon: "🔑",
    id: "passkey-check",
  });

  const securityLevelClass =
    securityScore >= 100
      ? "security-level--good"
      : securityScore >= 50
        ? "security-level--medium"
        : "security-level--low";
  const securityItemTitle =
    securityScore >= 100 ? t('Ваш аккаунт под защитой') : t('Проверка безопасности');
  const securityItemSubtitle =
    securityScore >= 100
      ? t('Ваш аккаунт прошёл Проверку безопасности. Рекомендуемых действий не найдено.')
      : t('Обнаружены рекомендации по защите');
  const securityStatusLabel =
    securityScore >= 100
      ? t('Защищён')
      : securityScore >= 50
        ? t('Средняя')
        : t('Низкая');
  const securityAriaLabel = `${securityItemTitle}. ${securityItemSubtitle}. ${securityStatusLabel}`;

  return `
    <div class="sec-list">
      <button class="sec-item" id="secSecurityCheckItem" type="button" aria-label="${securityAriaLabel}">
        <div class="sec-left">
          <div class="sec-head-row">
            <div class="sec-icon-box">
              ${
                securityScore >= 100
                  ? `<img src="/assets/img/security/okey_64.png" width="32" height="32" alt="${t('Защищён')}" class="sec-icon-img" />`
                  : `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L4 6V11C4 16.55 7.84 21.74 13 23C18.16 21.74 22 16.55 22 11V6L12 2Z" fill="${securityScore >= 50 ? "#fbbf24" : "#ef4444"}" opacity="0.9"/>
              </svg>`
              }
            </div>
            <div class="sec-title">${securityItemTitle}</div>
          </div>
          <div class="sec-sub">${securityItemSubtitle}</div>
        </div>
        <div class="sec-right">
          <div id="securityStatusBadge" class="security-status-badge ${securityLevelClass}">
            ${securityScore >= 100 ? `✓ ${t('Защищён')}` : securityScore >= 50 ? `⚠ ${t('Средняя')}` : `⚠ ${t('Низкая')}`}
          </div>
          <svg class="sec-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" height="20" width="20" aria-hidden="true">
            <g><path fill="currentColor" d="M8.809,23.588l-1.617-1.176L14.764,12L7.191,1.588l1.617-1.176l8,11c0.255,0.351,0.255,0.825,0,1.176 L8.809,23.588z"></path></g>
          </svg>
        </div>
      </button>

      <div class="sec-panel is-hidden" id="secSecurityCheckPanel">
        <div class="sec-panel-inner">
          <div class="security-progress-track">
            <div id="securityProgressBar" class="security-progress-bar ${securityLevelClass}" data-score="${securityScore}"></div>
          </div>

          <div class="security-score-row">
            <div class="security-score-label">${t('Уровень защиты:')}</div>
            <div id="securityScoreText" class="security-score-text ${securityLevelClass}">${securityScore}%</div>
          </div>

          <div id="securityChecklist" class="security-checklist">
            ${securityChecks
              .map(
                (check) => `
              <div ${check.id ? `id="${check.id}"` : ""} class="security-check-item ${check.done ? "is-done" : ""}">
                <div class="security-check-icon">${check.icon}</div>
                <div class="security-check-text">${check.text}</div>
                ${check.done ? `<div class="security-check-done">${t('Выполнено')}</div>` : ""}
              </div>
            `,
              )
              .join("")}
          </div>

          <div id="securityRecommendations">
            ${
              securityScore < 100
                ? `
            <div class="security-recommendation security-recommendation--info">
              <div class="security-recommendation-title">${t('💡 Рекомендация')}</div>
              <div class="security-recommendation-text">
                ${
                  securityScore < 30
                    ? t('Начните с подтверждения email и включения 2FA для базовой защиты аккаунта.')
                    : securityScore < 50
                      ? t('Добавьте еще несколько методов защиты для повышения безопасности.')
                      : t('Отлично! Осталось совсем немного для максимальной защиты.')
                }
              </div>
            </div>
          `
                : `
            <div class="security-recommendation security-recommendation--ok">
              <div class="security-recommendation-title">${t('🎉 Превосходно!')}</div>
              <div class="security-recommendation-text">${t('Ваш аккаунт под надёжной защитой. Рекомендуемых действий не найдено.')}</div>
            </div>
          `
            }
          </div>
        </div>
      </div>

      <button class="sec-item" id="secEmailItem" type="button" aria-label="${t('Адрес электронной почты')} ${emailText}, ${emailBadgeLabel}">
        <div class="sec-left">
          <div class="sec-head-row">
            <div class="sec-icon-box">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 4H4C2.9 4 2.01 4.9 2.01 6L2 18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4ZM20 8L12 13L4 8V6L12 11L20 6V8Z" fill="#3b82f6" opacity="0.9"/>
              </svg>
            </div>
            <div class="sec-title">${t('Адрес электронной почты')}</div>
          </div>
          <div class="sec-sub">${emailText}</div>
        </div>
        <div class="sec-right">
          ${emailBadge}
          <svg class="sec-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" height="20" width="20" aria-hidden="true">
            <g><path fill="currentColor" d="M8.809,23.588l-1.617-1.176L14.764,12L7.191,1.588l1.617-1.176l8,11c0.255,0.351,0.255,0.825,0,1.176 L8.809,23.588z"></path></g>
          </svg>
        </div>
      </button>

      <div class="sec-panel is-hidden" id="secEmailPanel">
        <div class="sec-panel-inner">
          <div class="sec-status" id="secEmailStatus">${emailStatus}</div>
          <div class="sec-form-row">
            <input class="input" id="secEmailInp" type="email" placeholder="name@example.com" value="${escapeHtml(user.email || "")}" />
          </div>
          <div class="sec-actions">
            <button class="btn btn-outline" id="secEmailCancelBtn" type="button" aria-label="${t('Отменить')}">${t('Отменить')}</button>
            <button class="btn btn-primary" id="secEmailSaveBtn" type="button" aria-label="${t('Сохранить')}">${t('Сохранить')}</button>
          </div>
          <div class="sec-hint is-hidden" id="secEmailHint"></div>
          ${
            !emailVerified && user.email
              ? `<button class="btn btn-outline sec-mt-10" id="secEmailResendBtn" type="button" aria-label="${t('Отправить письмо ещё раз')}">${t('Отправить письмо ещё раз')}</button>`
              : ``
          }
        </div>
      </div>

      <button class="sec-item" id="secPassItem" type="button" aria-label="${t('Сменить пароль')} ${t('Последний раз был изменён:')} ${passChangedText}">
        <div class="sec-left">
          <div class="sec-head-row">
            <div class="sec-icon-box">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 8H17V6C17 3.24 14.76 1 12 1C9.24 1 7 3.24 7 6V8H6C4.9 8 4 8.9 4 10V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V10C20 8.9 19.1 8 18 8ZM12 17C10.9 17 10 16.1 10 15C10 13.9 10.9 13 12 13C13.1 13 14 13.9 14 15C14 16.1 13.1 17 12 17ZM15.1 8H8.9V6C8.9 4.29 10.29 2.9 12 2.9C13.71 2.9 15.1 4.29 15.1 6V8Z" fill="#8b5cf6" opacity="0.9"/>
              </svg>
            </div>
            <div class="sec-title">${t('Сменить пароль')}</div>
          </div>
          <div class="sec-sub">${t('Последний раз был изменён:')} ${passChangedText}</div>
        </div>
        <div class="sec-right">
          <svg class="sec-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" height="20" width="20" aria-hidden="true">
            <g><path fill="currentColor" d="M8.809,23.588l-1.617-1.176L14.764,12L7.191,1.588l1.617-1.176l8,11c0.255,0.351,0.255,0.825,0,1.176 L8.809,23.588z"></path></g>
          </svg>
        </div>
      </button>

      <div class="sec-panel is-hidden" id="secPassPanel">
        <div class="sec-panel-inner">
          <div class="sec-status" id="secPassStatus">—</div>
          <div class="sec-form-row">
            <label class="label sec-label">${t('Действующий пароль')}</label>
            <div class="pass-wrap">
              <input class="input" id="secPassCur" type="password" autocomplete="current-password" />
              <button type="button" class="pass-eye" data-target="secPassCur" aria-label="${t('Показать пароль')}"></button>
            </div>
          </div>
          <div class="sec-form-row sec-mt-10">
            <label class="label sec-label">${t('Новый пароль')}</label>
            <div class="pass-wrap">
              <input class="input" id="secPassNew" type="password" autocomplete="new-password" />
              <button type="button" class="pass-eye" data-target="secPassNew" aria-label="${t('Показать пароль')}"></button>
            </div>
            <div id="passHintsChange"></div>
          </div>
          <div class="sec-form-row sec-mt-10">
            <label class="label sec-label">${t('Введите новый пароль еще раз')}</label>
            <div class="pass-wrap">
              <input class="input" id="secPassNew2" type="password" autocomplete="new-password" />
              <button type="button" class="pass-eye" data-target="secPassNew2" aria-label="${t('Показать пароль')}"></button>
            </div>
          </div>
          <div class="sec-actions sec-mt-12">
            <button class="btn btn-outline" id="secPassCancelBtn" type="button" aria-label="${t('Отменить')}">${t('Отменить')}</button>
            <button class="btn btn-primary" id="secPassSaveBtn" type="button" aria-label="${t('Сохранить')}">${t('Сохранить')}</button>
          </div>
          <div class="sec-hint is-hidden" id="secPassHint"></div>
        </div>
      </div>

      <button class="sec-item" id="sec2FAItem" type="button" aria-label="${t('Двухфакторная аутентификация (2FA)')} ${t('Загрузка...')}">
        <div class="sec-left">
          <div class="sec-head-row">
            <div class="sec-icon-box">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M17 1H7C5.9 1 5 1.9 5 3V21C5 22.1 5.9 23 7 23H17C18.1 23 19 22.1 19 21V3C19 1.9 18.1 1 17 1ZM17 19H7V5H17V19ZM12 17C13.1 17 14 16.1 14 15C14 13.9 13.1 13 12 13C10.9 13 10 13.9 10 15C10 16.1 10.9 17 12 17Z" fill="#10b981" opacity="0.9"/>
              </svg>
            </div>
            <div class="sec-title">${t('Двухфакторная аутентификация (2FA)')}</div>
          </div>
          <div class="sec-sub" id="sec2FAStatus">${t('Загрузка...')}</div>
          <div class="sec-sub is-hidden" id="sec2FADate"></div>
        </div>
        <div class="sec-right">
          <svg class="sec-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" height="20" width="20" aria-hidden="true">
            <g><path fill="currentColor" d="M8.809,23.588l-1.617-1.176L14.764,12L7.191,1.588l1.617-1.176l8,11c0.255,0.351,0.255,0.825,0,1.176 L8.809,23.588z"></path></g>
          </svg>
        </div>
      </button>

      <div class="sec-panel is-hidden" id="sec2FAPanel">
        <div class="sec-panel-inner" id="sec2FAContent"></div>
      </div>

      <button class="sec-item" id="secPasskeysItem" type="button" aria-label="${t('Ключи доступа (Passkeys)')} ${t('Загрузка...')}">
        <div class="sec-left">
          <div class="sec-head-row">
            <div class="sec-icon-box">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12.65 10C11.7 7.31 8.9 5.5 5.77 6.12C3.48 6.58 1.62 8.41 1.14 10.7C0.32 14.57 3.26 18 7 18C9.61 18 11.83 16.33 12.65 14H17V18H21V14H23V10H12.65ZM7 14C5.9 14 5 13.1 5 12C5 10.9 5.9 10 7 10C8.1 10 9 10.9 9 12C9 13.1 8.1 14 7 14Z" fill="#f59e0b" opacity="0.9"/>
              </svg>
            </div>
            <div class="sec-title">${t('Ключи доступа (Passkeys)')}</div>
          </div>
          <div class="sec-sub" id="secPasskeysStatus">${t('Загрузка...')}</div>
        </div>
        <div class="sec-right">
          <svg class="sec-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" height="20" width="20" aria-hidden="true">
            <g><path fill="currentColor" d="M8.809,23.588l-1.617-1.176L14.764,12L7.191,1.588l1.617-1.176l8,11c0.255,0.351,0.255,0.825,0,1.176 L8.809,23.588z"></path></g>
          </svg>
        </div>
      </button>

      <div class="sec-panel is-hidden" id="secPasskeysPanel">
        <div class="sec-panel-inner" id="secPasskeysContent"></div>
      </div>

      <button class="sec-item" id="secDevicesItem" type="button" aria-label="${t('Доверенные устройства')} ${t('Управление устройствами для входа с 2FA')}">
        <div class="sec-left">
          <div class="sec-head-row">
            <div class="sec-icon-box">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 18C21.1 18 21.99 17.1 21.99 16L22 6C22 4.9 21.1 4 20 4H4C2.9 4 2 4.9 2 6V16C2 17.1 2.9 18 4 18H0V20H24V18H20ZM4 6H20V16H4V6Z" fill="#06b6d4" opacity="0.9"/>
              </svg>
            </div>
            <div class="sec-title">${t('Доверенные устройства')}</div>
          </div>
          <div class="sec-sub">${t('Управление устройствами для входа с 2FA')}</div>
        </div>
        <div class="sec-right">
          <svg class="sec-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" height="20" width="20" aria-hidden="true">
            <g><path fill="currentColor" d="M8.809,23.588l-1.617-1.176L14.764,12L7.191,1.588l1.617-1.176l8,11c0.255,0.351,0.255,0.825,0,1.176 L8.809,23.588z"></path></g>
          </svg>
        </div>
      </button>

      <div class="sec-panel is-hidden" id="secDevicesPanel">
        <div class="sec-panel-inner">
          <div class="sec-status sec-status-muted">
            ${t('Доверенные устройства для входа с 2FA. Эти устройства не требуют код при входе.')}
          </div>
          <div id="trustedDevicesList" class="sec-muted-text">${t('Загружаю...')}</div>
        </div>
      </div>

      <button class="sec-item" id="secHistoryItem" type="button" aria-label="${t('История входов')} ${t('Просмотр активности аккаунта')}">
        <div class="sec-left">
          <div class="sec-head-row">
            <div class="sec-icon-box">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M13 3C8.03 3 4 7.03 4 12H1L4.89 15.89L4.96 16.03L9 12H6C6 8.13 9.13 5 13 5C16.87 5 20 8.13 20 12C20 15.87 16.87 19 13 19C11.07 19 9.32 18.21 8.06 16.94L6.64 18.36C8.27 19.99 10.51 21 13 21C17.97 21 22 16.97 22 12C22 7.03 17.97 3 13 3ZM12 8V13L16.25 15.52L17.02 14.24L13.5 12.15V8H12Z" fill="#64748b" opacity="0.9"/>
              </svg>
            </div>
            <div class="sec-title">${t('История входов')}</div>
          </div>
          <div class="sec-sub">${t('Просмотр активности аккаунта')}</div>
        </div>
        <div class="sec-right">
          <svg class="sec-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" height="20" width="20" aria-hidden="true">
            <g><path fill="currentColor" d="M8.809,23.588l-1.617-1.176L14.764,12L7.191,1.588l1.617-1.176l8,11c0.255,0.351,0.255,0.825,0,1.176 L8.809,23.588z"></path></g>
          </svg>
        </div>
      </button>

      <div class="sec-panel is-hidden" id="secHistoryPanel">
        <div class="sec-panel-inner">
          <div class="sec-status sec-status-muted">
            ${t('История входов в аккаунт за последнее время')}
          </div>
          <div id="loginHistoryList" class="sec-muted-text">${t('Загружаю...')}</div>
        </div>
      </div>

    </div>
  `;
}

function renderSessionsTab(_user: User): string {
  return `
    <div id="sessionsList" class="sec-muted-text sec-font-13">
      ${t('Загружаю список устройств…')}
    </div>
  `;
}

function renderEasterTab(user: User): string {
  const hasStrawberry =
    localStorage.getItem("cyb_strawberry_unlocked") === "1" ||
    !!user.easter?.strawberry;
  const hasDarkTrigger =
    localStorage.getItem("cyb_dark_trigger_unlocked") === "1" ||
    !!user.easter?.darkTrigger;
  const hasProfileMirror =
    localStorage.getItem("cyb_profile_mirror_unlocked") === "1" ||
    !!user.easter?.profileMirror;

  console.log(
    "[EASTER] hasStrawberry:",
    hasStrawberry,
    "hasDarkTrigger:",
    hasDarkTrigger,
    "hasProfileMirror:",
    hasProfileMirror,
    "user.easter:",
    user.easter,
  );

  return `
    <div>
      <div class="easter-intro">
        ${t('🎯 Пасхалки открываются, когда ты находишь секреты на сайте')}
      </div>

      <h3 class="easter-section-title">
        <span>🎁</span>
        <span>${t('Обычные пасхалки')}</span>
      </h3>

      <div class="easter-grid">
        <div class="easter-card ${hasStrawberry ? "" : "locked"}">
          ${
            hasStrawberry
              ? `<span class="easter-card-badge">${t('✓ Найдено')}</span>`
              : `<span class="easter-card-badge locked">${t('🔒 Закрыто')}</span>`
          }
          <div class="easter-strawberry-wrap" aria-hidden="true">
            <span class="easter-strawberry special">🍓</span>
          </div>
          <div class="easter-card-title">
            Strawberry Hunt
          </div>
          <div class="easter-card-desc">
            ${
              hasStrawberry
                ? t('Ты нашел особую клубничку на сайте! Отличная работа 🎉')
                : t('Найди спрятанную клубничку где-то там...')
            }
          </div>
          ${
            hasStrawberry
              ? `<button 
                  id="toHistoryBtn"
                  class="btn btn-outline easter-action-btn"
                  type="button"
                 aria-label="${t('📖 Открыть стенографию')}">
                  <span class="easter-action-icon">📖</span>
                  <span>${t('Открыть стенографию')}</span>
                </button>`
              : `<div class="easter-hint">${t('💡 Подсказка: исследуй страницы входа...')}</div>`
          }
          ${hasStrawberry ? `<div class="easter-hint">${t('🎊 Поздравляем с находкой!')}</div>` : ""}
        </div>

        <div class="easter-card ${hasProfileMirror ? "" : "locked"}">
          ${
            hasProfileMirror
              ? `<span class="easter-card-badge">${t('✓ Найдено')}</span>`
              : `<span class="easter-card-badge locked">${t('🔒 Закрыто')}</span>`
          }
          <span class="easter-card-icon easter-mirror">🪞</span>
          <div class="easter-card-title">
            ${t('Зеркало профиля')}
          </div>
          <div class="easter-card-desc">
            ${
              hasProfileMirror
                ? t('Семь отражений — и ты увидел себя с другой стороны')
                : t('Секрет спрятан там, где ты показываешь себя миру')
            }
          </div>
          ${
            hasProfileMirror
              ? `<button
                  type="button"
                  class="btn btn-outline easter-action-btn"
                  data-route="${escapeHtml(user.login || user.username || "")}"
                  aria-label="${t('Открыть свой профиль')}"
                >
                  <span class="easter-action-icon">👤</span>
                  <span>${t('Мой профиль')}</span>
                </button>`
              : `<div class="easter-hint">${t('💡 Подсказка: загляни в свой профиль и посмотри на себя чаще...')}</div>`
          }
          ${hasProfileMirror ? `<div class="easter-hint">${t('🎊 Ты заглянул в своё отражение!')}</div>` : ""}
        </div>
      </div>

      <h3 class="easter-section-title">
        <span>🌟</span>
        <span>${t('Редкие пасхалки')}</span>
      </h3>

      <div class="easter-grid">
        <div class="easter-card ${hasDarkTrigger ? "easter-card-rare" : "locked"}">
          ${
            hasDarkTrigger
              ? `<span class="easter-card-badge">${t('✓ Найдено')}</span>`
              : `<span class="easter-card-badge locked">${t('🔒 Закрыто')}</span>`
          }
          <span class="easter-card-icon easter-moon">🌑</span>
          <div class="easter-card-title">
            Dark Trigger
          </div>
          <div class="easter-card-desc">
            ${
              hasDarkTrigger
                ? t('Ты заметил тёмный триггер в полной темноте! Редкое достижение 🌟')
                : t('Разгадай загадку тьмы, припрятанную где-то на сайте')
            }
          </div>
          ${
            hasDarkTrigger
              ? `<a 
                  href="${sitePath('dark/trig/c4...77/media/dark-trigger.jpg', getLocale())}" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  class="btn btn-outline easter-action-btn easter-action-link"
                >
                  <span class="easter-action-icon">👁️</span>
                  <span>${t('Бусинвальд')}</span>
                </a>`
              : `<div class="easter-hint">${t('💡 Подсказка: посмотри в тёмную папку на сайте...')}</div>`
          }
          ${
            hasDarkTrigger
              ? `<div class="easter-hint">${t('🎊 Конгратулейшн, ты настоящий детектив!')}</div>`
              : ""
          }
        </div>
      </div>
    </div>
  `;
}

function renderFriendsTab(): string {
  return `
    <div id="friendsContent">
      <div class="loading-spinner loading-spinner--centered">
        <div class="spinner loading-spinner__icon"></div>
        <p class="loading-spinner__text">${t('Загрузка списка друзей...')}</p>
      </div>
    </div>
  `;
}

function renderMessagesTab(): string {
  return `
    <div id="messagesContent">
      <div class="loading-spinner loading-spinner--centered">
        <div class="spinner loading-spinner__icon"></div>
        <p class="loading-spinner__text">${t('Загрузка сообщений...')}</p>
      </div>
    </div>
  `;
}

export function renderTabContent(tab: string, user: User): string {
  switch (tab) {
    case "profile":
      return renderProfileTab(user);
    case "friends":
      return renderFriendsTab();
    case "messages":
      return renderMessagesTab();
    case "security":
      return renderSecurityTab(user);
    case "sessions":
      return renderSessionsTab(user);
    case "easter":
      return renderEasterTab(user);
    default:
      return "<div>—</div>";
  }
}

export function getTabTitle(tab: string): string {
  const titles: Record<string, string> = {
    profile: t('Профиль'),
    friends: t('Друзья'),
    messages: t('Сообщения'),
    security: t('Безопасность'),
    sessions: t('Сессии'),
    easter: t('Пасхалки'),
  };
  return titles[tab] || t('Учётка');
}
