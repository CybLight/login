import { t, getLocale, localeTag, sitePath, siteRootPath } from '@/i18n';
import type { UserEasterFlags } from "@/types";
import { escapeHtml } from "@/utils";
import {
  formatPendingDate,
  formatRemainingShort,
  getPendingEmailInfo,
  renderPendingCardTextHtml,
  renderPendingStatusHtml,
  renderPendingSubHtml,
} from "./account-utils";
import { getAvatarInnerHtml } from "./avatar";
import {
  countV010UnlockedEggs,
  renderFormatMirrorEasterCard,
  renderV010AppEasterCards,
} from "./easter-v010-render";

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
  pendingEmail?: string | null;
  pending_email?: string | null;
  pendingEmailVerifiedAt?: number | null;
  pending_email_verified_at?: number | null;
  pendingEmailCompletesAt?: number | null;
  pending_email_completes_at?: number | null;
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

  const pending = getPendingEmailInfo(user as Record<string, unknown>);
  const pendingEmail = pending?.pendingEmail || "";
  const pendingVerifiedAt = pending?.pendingVerifiedAt || 0;
  const pendingCompletesAt = pending?.pendingCompletesAt || 0;
  const twoFAOn = !!(user.twoFactorEnabled || user.totp_enabled);
  const requiresAuthToChange = emailVerified && !!user.email;

  const pendingRemainingShort =
    pendingVerifiedAt && pendingCompletesAt ? formatRemainingShort(pendingCompletesAt) : "";

  const emailSubHtml = pending && user.email
    ? renderPendingSubHtml(user.email, pendingEmail)
    : emailText;

  const emailBadgePending = pendingEmail
    ? `<span class="sec-badge sec-badge--warn" id="secEmailBadge">${t('Смена запланирована')}</span>`
    : emailBadge;

  const emailStatus = pending
    ? renderPendingStatusHtml(pending)
    : emailVerified
      ? t('✅ Email подтверждён')
      : user.email
        ? t('⚠️ Email не подтверждён')
        : t('Email не указан');

  const pendingCard = pending
    ? `<div class="sec-email-pending" id="secEmailPendingCard">
        <div class="sec-email-pending-main">
          <div class="sec-email-pending-icon" aria-hidden="true">⏳</div>
          <div class="sec-email-pending-body">
            <div class="sec-email-pending-title" id="secEmailPendingTitle">
              ${pendingVerifiedAt
                ? t('Запланирована смена email')
                : t('Подтвердите новый email')}
            </div>
            <div class="sec-email-pending-text" id="secEmailPendingText">
              ${renderPendingCardTextHtml(pending)}
            </div>
            <div class="sec-email-pending-countdown" id="secEmailPendingCountdown" ${pendingVerifiedAt ? "" : 'style="display:none"'}>
              ${pendingRemainingShort
                ? t('Осталось: {time}', { time: pendingRemainingShort })
                : ""}
            </div>
          </div>
        </div>
        <div class="sec-email-pending-actions">
          <button class="btn btn-outline" type="button" data-cancel-pending-email>${t('Отменить смену')}</button>
        </div>
      </div>`
    : `<div class="sec-email-pending is-hidden" id="secEmailPendingCard" hidden></div>`;

  const pendingBanner = pendingEmail
    ? `<div class="sec-hint sec-hint--warn sec-mt-10" id="secEmailPendingBanner">
        <span id="secEmailPendingBannerText">
        ${pendingVerifiedAt && pendingCompletesAt
          ? t('Новый адрес {email} подтверждён. Смена завершится {date}.', {
              email: escapeHtml(pendingEmail),
              date: formatPendingDate(pendingCompletesAt),
            })
          : t('Запрошена смена на {email}. Подтвердите письмо на новом адресе.', {
              email: escapeHtml(pendingEmail),
            })}
        </span>
        <button class="btn btn-outline sec-mt-10" type="button" data-cancel-pending-email>${t('Отменить смену')}</button>
      </div>`
    : "";

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
    ${pendingCard}
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
          <div class="sec-sub${pendingEmail ? " sec-sub--pending" : ""}" id="secEmailSub">${emailSubHtml}</div>
        </div>
        <div class="sec-right">
          ${emailBadgePending}
          <svg class="sec-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" height="20" width="20" aria-hidden="true">
            <g><path fill="currentColor" d="M8.809,23.588l-1.617-1.176L14.764,12L7.191,1.588l1.617-1.176l8,11c0.255,0.351,0.255,0.825,0,1.176 L8.809,23.588z"></path></g>
          </svg>
        </div>
      </button>

      <div class="sec-panel is-hidden" id="secEmailPanel">
        <div class="sec-panel-inner">
          <div class="sec-status${pending ? " sec-status--pending" : ""}" id="secEmailStatus">${emailStatus}</div>
          ${pendingBanner}
          <div class="sec-form-row">
            <input class="input" id="secEmailInp" type="email" placeholder="name@example.com" value="${escapeHtml(user.email || "")}" ${pendingEmail ? "disabled" : ""} />
          </div>
          ${
            requiresAuthToChange
              ? `
          <div class="sec-form-row sec-mt-10" id="secEmailAuthFields">
            <label class="sec-label" for="secEmailPass">${t('Текущий пароль')}</label>
            <div class="pass-wrap">
              <input class="input" id="secEmailPass" type="password" autocomplete="current-password" />
              <button type="button" class="pass-eye" data-target="secEmailPass" aria-label="${t('Показать пароль')}"></button>
            </div>
          </div>
          ${
            twoFAOn
              ? `
          <div class="sec-form-row sec-mt-10">
            <label class="sec-label" for="secEmailTotp">${t('Код 2FA')}</label>
            <input class="input" id="secEmailTotp" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" />
          </div>`
              : ""
          }
          <p class="sec-hint sec-mt-10">${t('Смена подтверждённого email требует пароль{twoFA}. Новый адрес вступит в силу через 24 часа после подтверждения.', { twoFA: twoFAOn ? t(' и код 2FA') : '' })}</p>`
              : ""
          }
          <div class="sec-actions">
            <button class="btn btn-outline" id="secEmailCancelBtn" type="button" aria-label="${t('Отменить')}">${t('Отменить')}</button>
            <button class="btn btn-primary" id="secEmailSaveBtn" type="button" aria-label="${t('Сохранить')}" ${pendingEmail ? "disabled" : ""}>${t('Сохранить')}</button>
          </div>
          <div class="sec-hint is-hidden" id="secEmailHint"></div>
          ${
            (!emailVerified && user.email) || (pendingEmail && !pendingVerifiedAt)
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

      <button class="sec-item" id="secBackupItem" type="button" aria-label="${t('Резервная копия шифрования')} ${t('Экспорт и импорт ключей шифрования между устройствами')}">
        <div class="sec-left">
          <div class="sec-head-row">
            <div class="sec-icon-box">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4C9.11 4 6.6 5.64 5.35 8.04C2.34 8.36 0 10.91 0 14C0 17.31 2.69 20 6 20H19C21.76 20 24 17.76 24 15C24 12.36 21.95 10.22 19.35 10.04ZM12 13L16 17H13V21H11V17H8L12 13Z" fill="#8b5cf6" opacity="0.9"/>
              </svg>
            </div>
            <div class="sec-title">${t('Резервная копия шифрования')}</div>
          </div>
          <div class="sec-sub">${t('Google Drive или файл .cyblight-backup')}</div>
        </div>
        <div class="sec-right">
          <svg class="sec-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" height="20" width="20" aria-hidden="true">
            <g><path fill="currentColor" d="M8.809,23.588l-1.617-1.176L14.764,12L7.191,1.588l1.617-1.176l8,11c0.255,0.351,0.255,0.825,0,1.176 L8.809,23.588z"></path></g>
          </svg>
        </div>
      </button>

      <div class="sec-panel is-hidden" id="secBackupPanel">
        <div class="sec-panel-inner sec-backup-panel">
          <div class="sec-status sec-status-muted">
            ${t('Создайте зашифрованную копию ключей и сообщений в Google Drive или скачайте файл для переноса между устройствами.')}
          </div>

          <div class="sec-form-block sec-form-block--drive">
            <div class="sec-form-block-head">
              <span class="sec-form-block-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#34A853" d="M12 2L2 19h7.5l2.5-4.5L14.5 19H22L12 2z"/>
                  <path fill="#FBBC04" d="M12 2L7.5 10.5 10 14.5 14.5 19H22L12 2z"/>
                  <path fill="#4285F4" d="M2 19h7.5l2.5-4.5L10 14.5 7.5 10.5 2 19z"/>
                </svg>
              </span>
              <div class="sec-form-title">${t('Google Drive')}</div>
            </div>
            <p class="sec-hint">${t('Сохраните зашифрованную копию в ваш Google Drive. Доступ только у приложения CybLight и только к созданным им файлам.')}</p>
            <p class="sec-status sec-status-muted sec-drive-account is-hidden" id="secDriveBackupAccount"></p>
            <p class="sec-status sec-status-muted" id="secDriveBackupStatus">${t('Загрузка статуса…')}</p>
            <div class="sec-form-row">
              <label class="label sec-label" for="secDriveBackupPassword">${t('Пароль резервной копии')}</label>
              <div class="pass-wrap">
                <input class="input" id="secDriveBackupPassword" type="password" autocomplete="current-password" placeholder="${t('Пароль от резервной копии')}" />
                <button type="button" class="pass-eye" data-target="secDriveBackupPassword" aria-label="${t('Показать пароль')}"></button>
              </div>
            </div>
            <div class="sec-backup-progress sec-backup-progress--drive is-hidden" id="secDriveBackupProgress" aria-live="polite" aria-busy="false">
              <div class="sec-backup-progress__head">
                <span class="sec-backup-progress__label" id="secDriveBackupProgressLabel">${t('Подготовка…')}</span>
                <span class="sec-backup-progress__percent" id="secDriveBackupProgressPercent">0%</span>
              </div>
              <div class="sec-backup-progress__track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="secDriveBackupProgressTrack">
                <div class="sec-backup-progress__bar" id="secDriveBackupProgressBar" style="width: 0%"></div>
              </div>
            </div>
            <div class="sec-actions sec-mt-12 sec-actions--wrap">
              <button class="btn btn-primary" id="secDriveBackupUploadBtn" type="button">${t('Сохранить в Google Drive')}</button>
              <button class="btn btn-outline" id="secDriveBackupRestoreBtn" type="button">${t('Восстановить из Google Drive')}</button>
              <button class="btn btn-outline btn-danger-outline" id="secDriveBackupDeleteBtn" type="button">${t('Удалить из Drive')}</button>
              <button class="btn btn-outline" id="secDriveBackupDisconnectBtn" type="button">${t('Выйти из Google')}</button>
            </div>
          </div>

          <div class="sec-form-block sec-form-block--export">
            <div class="sec-form-block-head">
              <span class="sec-form-block-icon" aria-hidden="true">📤</span>
              <div class="sec-form-title">${t('Экспорт')}</div>
            </div>
            <div class="sec-form-row">
              <label class="label sec-label" for="secBackupExportPassword">${t('Пароль резервной копии')}</label>
              <p class="sec-hint">${t('Минимум 8 символов. Запомните пароль — без него нельзя восстановить ключи.')}</p>
              <div class="pass-wrap">
                <input class="input" id="secBackupExportPassword" type="password" autocomplete="new-password" placeholder="${t('Длина минимум 8 символов')}" />
                <button type="button" class="pass-eye" data-target="secBackupExportPassword" aria-label="${t('Показать пароль')}"></button>
              </div>
            </div>
            <div class="sec-form-row sec-mt-10">
              <label class="label sec-label" for="secBackupExportPasswordConfirm">${t('Повторите пароль')}</label>
              <div class="pass-wrap">
                <input class="input" id="secBackupExportPasswordConfirm" type="password" autocomplete="new-password" placeholder="${t('Повторите пароль')}" />
                <button type="button" class="pass-eye" data-target="secBackupExportPasswordConfirm" aria-label="${t('Показать пароль')}"></button>
              </div>
            </div>
            <div class="sec-actions sec-mt-12">
              <button class="btn btn-primary" id="secBackupExportBtn" type="button">${t('Скачать .cyblight-backup')}</button>
            </div>
          </div>

          <div class="sec-form-block sec-form-block--import">
            <div class="sec-form-block-head">
              <span class="sec-form-block-icon" aria-hidden="true">📥</span>
              <div class="sec-form-title">${t('Импорт')}</div>
            </div>
            <div class="sec-form-row">
              <label class="label sec-label" for="secBackupImportPassword">${t('Пароль резервной копии')}</label>
              <p class="sec-hint">${t('Пароль, заданный при создании резервной копии.')}</p>
              <div class="pass-wrap">
                <input class="input" id="secBackupImportPassword" type="password" autocomplete="current-password" placeholder="${t('Пароль от файла резервной копии')}" />
                <button type="button" class="pass-eye" data-target="secBackupImportPassword" aria-label="${t('Показать пароль')}"></button>
              </div>
            </div>
            <input class="is-hidden" id="secBackupFileInput" type="file" accept=".cyblight-backup,application/json" />
            <div class="sec-backup-progress is-hidden" id="secBackupImportProgress" aria-live="polite" aria-busy="false">
              <div class="sec-backup-progress__head">
                <span class="sec-backup-progress__label" id="secBackupImportProgressLabel">${t('Восстановление резервной копии…')}</span>
                <span class="sec-backup-progress__percent" id="secBackupImportProgressPercent">0%</span>
              </div>
              <div class="sec-backup-progress__track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="secBackupImportProgressTrack">
                <div class="sec-backup-progress__bar" id="secBackupImportProgressBar" style="width: 0%"></div>
              </div>
            </div>
            <div class="sec-actions sec-mt-12">
              <button class="btn btn-outline" id="secBackupImportBtn" type="button">${t('Выбрать файл и восстановить')}</button>
            </div>
          </div>
        </div>
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

function easterProgressHtml(current: number, total: number): string {
  return `<div class="easter-card-progress">${escapeHtml(
    t("{current} из {total}", { current: String(current), total: String(total) }),
  )}</div>`;
}

const EASTER_EGGS_TOTAL = 30;

function easterCollectionSummaryHtml(found: number, total: number = EASTER_EGGS_TOTAL): string {
  const isComplete = found >= total;
  const text = isComplete
    ? t("Все получено! 👑")
    : t("{found} из {total} получено", {
        found: String(found),
        total: String(total),
      });
  const completeClass = isComplete ? " easter-collection-summary--complete" : "";
  return `<div class="easter-collection-summary${completeClass}">${escapeHtml(text)}</div>`;
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
  const hasLightCatcher =
    localStorage.getItem("cyb_light_catcher_unlocked") === "1" ||
    !!user.easter?.lightCatcher;
  const hasPostmaster =
    localStorage.getItem("cyb_postmaster_unlocked") === "1" ||
    !!user.easter?.postmaster;
  const hasDeveloperMode =
    localStorage.getItem("cyb_developer_mode_unlocked") === "1" ||
    !!user.easter?.developerMode;
  const hasThemeFlux =
    localStorage.getItem("cyb_theme_flux_unlocked") === "1" ||
    !!user.easter?.themeFlux;
  const hasNightGuard = !!user.easter?.nightGuard;
  const hasTrustedFingerprint = !!user.easter?.trustedFingerprint;
  const hasBridge = !!user.easter?.bridge;
  const hasEcho = !!user.easter?.echo;
  const hasArchivist = !!user.easter?.archivist;
  const bridgeWebToday =
    user.easter?.bridgeWebToday === true || user.easter?.bridge_web_today === true;
  const bridgeAppToday =
    user.easter?.bridgeAppToday === true || user.easter?.bridge_app_today === true;
  const bridgePlatformsToday = (bridgeWebToday ? 1 : 0) + (bridgeAppToday ? 1 : 0);
  const easterFoundCount =
    [
      hasStrawberry,
      hasProfileMirror,
      hasDarkTrigger,
      hasPostmaster,
      hasDeveloperMode,
      hasThemeFlux,
      hasLightCatcher,
      hasNightGuard,
      hasTrustedFingerprint,
      hasEcho,
      hasArchivist,
      hasBridge,
    ].filter(Boolean).length + countV010UnlockedEggs(user.easter);

  console.log(
    "[EASTER] hasStrawberry:",
    hasStrawberry,
    "hasDarkTrigger:",
    hasDarkTrigger,
    "hasProfileMirror:",
    hasProfileMirror,
    "hasLightCatcher:",
    hasLightCatcher,
    "hasPostmaster:",
    hasPostmaster,
    "hasDeveloperMode:",
    hasDeveloperMode,
    "hasThemeFlux:",
    hasThemeFlux,
    "user.easter:",
    user.easter,
  );

  const downloadsUrl = sitePath("downloads", getLocale());
  const androidDownloadLink = `
    <a
      href="${downloadsUrl}"
      target="_blank"
      rel="noopener noreferrer"
      class="btn btn-outline easter-action-btn easter-action-link"
    >
      <span class="easter-action-icon">📲</span>
      <span>${t("Скачать приложение")}</span>
    </a>
  `;

  return `
    <div class="easter-page">
      <div class="easter-intro">
        ${t('🎯 Пасхалки открываются, когда ты находишь секреты на сайте и в приложении')}
      </div>

      ${easterCollectionSummaryHtml(easterFoundCount)}

      <div class="easter-subtabs" role="tablist" aria-label="${t('Категории пасхалок')}">
        <button
          type="button"
          class="easter-subtab active"
          data-easter-tab="site"
          role="tab"
          aria-selected="true"
          aria-controls="easter-panel-site"
          id="easter-tab-site"
        >
          <span aria-hidden="true">🌐</span>
          <span>${t('На сайте')}</span>
        </button>
        <button
          type="button"
          class="easter-subtab"
          data-easter-tab="app"
          role="tab"
          aria-selected="false"
          aria-controls="easter-panel-app"
          id="easter-tab-app"
        >
          <span aria-hidden="true">📱</span>
          <span>${t('В приложении')}</span>
        </button>
        <button
          type="button"
          class="easter-subtab"
          data-easter-tab="bridge"
          role="tab"
          aria-selected="false"
          aria-controls="easter-panel-bridge"
          id="easter-tab-bridge"
        >
          <span aria-hidden="true">🌉</span>
          <span>${t('Связующие')}</span>
        </button>
      </div>

      <div
        class="easter-subpanel active"
        data-easter-panel="site"
        role="tabpanel"
        id="easter-panel-site"
        aria-labelledby="easter-tab-site"
      >
      <div class="easter-grid">
        <div class="easter-card easter-card--strawberry ${hasStrawberry ? "" : "locked"}">
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

        <div class="easter-card easter-card--profile-mirror ${hasProfileMirror ? "" : "locked"}">
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
        <div class="easter-card easter-card--dark-trigger ${hasDarkTrigger ? "easter-card-rare" : "locked"}">
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
                  href="${siteRootPath('dark/trig/c4...77/media/dark-trigger.jpg')}" 
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

        <div class="easter-card easter-card--postmaster ${hasPostmaster ? "" : "locked"}">
          ${
            hasPostmaster
              ? `<span class="easter-card-badge">${t('✓ Найдено')}</span>`
              : `<span class="easter-card-badge locked">${t('🔒 Закрыто')}</span>`
          }
          <span class="easter-card-icon">📬</span>
          <div class="easter-card-title">
            Postmaster
          </div>
          <div class="easter-card-desc">
            ${
              hasPostmaster
                ? t('Ты прочитал письмо до самого конца — настоящий почтовый детектив')
                : t('Секрет спрятан там, где заканчиваются автоматические письма')
            }
          </div>
          ${
            hasPostmaster
              ? `<div class="easter-hint">${t('🎊 Секрет из ящика входящих пойман!')}</div>`
              : `<div class="easter-hint">${t('💡 Подсказка: загляни в письмо о восстановлении пароля...')}</div>`
          }
        </div>

        <div class="easter-card easter-card--developer-mode ${hasDeveloperMode ? "" : "locked"}">
          ${
            hasDeveloperMode
              ? `<span class="easter-card-badge">${t('✓ Найдено')}</span>`
              : `<span class="easter-card-badge locked">${t('🔒 Закрыто')}</span>`
          }
          <span class="easter-card-icon">🛠️</span>
          <div class="easter-card-title">
            Developer Mode
          </div>
          <div class="easter-card-desc">
            ${
              hasDeveloperMode
                ? t('Ты открыл DevTools и поймал бегущую строку в футере')
                : t('Редкий секрет для самых внимательных')
            }
          </div>
          ${
            hasDeveloperMode
              ? `<div class="easter-hint">${t('🎊 console.log("found") — секрет под капотом!')}</div>`
              : `<div class="easter-hint">${t('💡 Подсказка: Загляни под капот сайта')}</div>`
          }
        </div>

        <div class="easter-card easter-card--theme-flux ${hasThemeFlux ? "" : "locked"}">
          ${
            hasThemeFlux
              ? `<span class="easter-card-badge">${t('✓ Найдено')}</span>`
              : `<span class="easter-card-badge locked">${t('🔒 Закрыто')}</span>`
          }
          <span class="easter-card-icon">🌗</span>
          <div class="easter-card-title">
            ${t('Маятник')}
          </div>
          <div class="easter-card-desc">
            ${
              hasThemeFlux
                ? t('Ты раскачал сайт между светом и тьмой — настроение поймано')
                : t('Секрет для тех, кто не может выбрать одну тему')
            }
          </div>
          ${
            hasThemeFlux
              ? `<div class="easter-hint">${t('🎊 Свет ↔ тьма — и секрет ваш!')}</div>`
              : `<div class="easter-hint">${t('💡 Подсказка: покачай настроение сайта — свет, тьма, свет...')}</div>`
          }
        </div>
      </div>
      </div>

      <div
        class="easter-subpanel"
        data-easter-panel="app"
        role="tabpanel"
        id="easter-panel-app"
        aria-labelledby="easter-tab-app"
        hidden
      >
      <div class="easter-app-download">
        ${androidDownloadLink}
      </div>
      <div class="easter-grid">
        <div class="easter-card easter-card--light-catcher ${hasLightCatcher ? "" : "locked"}">
          ${
            hasLightCatcher
              ? `<span class="easter-card-badge">${t('✓ Найдено')}</span>`
              : `<span class="easter-card-badge locked">${t('🔒 Закрыто')}</span>`
          }
          <span class="easter-card-icon">💡</span>
          <div class="easter-card-title">${t('Ловец света')}</div>
          <div class="easter-card-desc">
            ${
              hasLightCatcher
                ? t('Ты поймал свет в приложении CybLight! Быстрые пальцы ⚡')
                : t('Свет спрятан в мобильном приложении CybLight')
            }
          </div>
          ${
            hasLightCatcher
              ? `<div class="easter-hint">${t('🎊 Свет пойман — секрет сохранён!')}</div>`
              : `<div class="easter-hint">${t('💡 Подсказка: проверь на прочность версию Android приложения')}</div>`
          }
        </div>

        <div class="easter-card easter-card--night-guard ${hasNightGuard ? "" : "locked"}">
          ${hasNightGuard ? `<span class="easter-card-badge">${t('✓ Найдено')}</span>` : `<span class="easter-card-badge locked">${t('🔒 Закрыто')}</span>`}
          <span class="easter-card-icon">🌙</span>
          <div class="easter-card-title">${t('Ночной страж')}</div>
          <div class="easter-card-desc">${hasNightGuard ? t('Ты бодрствуешь в тёмной теме после полуночи') : t('Ночь, тёмная тема и 30 секунд терпения')}</div>
          ${hasNightGuard ? "" : `<div class="easter-hint">${t('💡 Подсказка: включи тёмную тему после 00:00 и останься в приложении')}</div>`}
        </div>

        <div class="easter-card easter-card--trusted-fingerprint ${hasTrustedFingerprint ? "" : "locked"}">
          ${hasTrustedFingerprint ? `<span class="easter-card-badge">${t('✓ Найдено')}</span>` : `<span class="easter-card-badge locked">${t('🔒 Закрыто')}</span>`}
          <span class="easter-card-icon">👆</span>
          <div class="easter-card-title">${t('Отпечаток доверия')}</div>
          <div class="easter-card-desc">${hasTrustedFingerprint ? t('Сто раз подтвердил вход биометрией') : t('Биометрия должна узнать тебя наизусть')}</div>
          ${hasTrustedFingerprint ? "" : `<div class="easter-hint">${t('💡 Подсказка: разблокируй приложение отпечатком 100 раз')}</div>`}
        </div>

        <div class="easter-card easter-card--echo ${hasEcho ? "" : "locked"}">
          ${hasEcho ? `<span class="easter-card-badge">${t('✓ Найдено')}</span>` : `<span class="easter-card-badge locked">${t('🔒 Закрыто')}</span>`}
          <span class="easter-card-icon">🔔</span>
          <div class="easter-card-title">${t('Эхо')}</div>
          <div class="easter-card-desc">${hasEcho ? t('Сообщение ушло в полночь — эхо услышано') : t('Отправь сообщение ровно в 23:59')}</div>
          ${hasEcho ? "" : `<div class="easter-hint">${t('💡 Подсказка: поймай минуту перед полуночью в чате')}</div>`}
        </div>

        <div class="easter-card easter-card--archivist ${hasArchivist ? "" : "locked"}">
          ${hasArchivist ? `<span class="easter-card-badge">${t('✓ Найдено')}</span>` : `<span class="easter-card-badge locked">${t('🔒 Закрыто')}</span>`}
          <span class="easter-card-icon">📚</span>
          <div class="easter-card-title">${t('Архивариус')}</div>
          <div class="easter-card-desc">${hasArchivist ? t('Закрепил, изменил, отреагировал и переслал в одном чате') : t('Освой все инструменты сообщений в одном диалоге')}</div>
          ${hasArchivist ? "" : `<div class="easter-hint">${t('💡 Подсказка: закрепи, измени, поставь реакцию и перешли в одном чате')}</div>`}
        </div>

        ${renderV010AppEasterCards(user.easter)}
      </div>
      </div>

      <div
        class="easter-subpanel"
        data-easter-panel="bridge"
        role="tabpanel"
        id="easter-panel-bridge"
        aria-labelledby="easter-tab-bridge"
        hidden
      >
      <div class="easter-grid">
        <div class="easter-card easter-card--bridge ${hasBridge ? "" : "locked"}">
          ${hasBridge ? `<span class="easter-card-badge">${t('✓ Найдено')}</span>` : `<span class="easter-card-badge locked">${t('🔒 Закрыто')}</span>`}
          <span class="easter-card-icon">🌉</span>
          <div class="easter-card-title">${t('Мост')}</div>
          <div class="easter-card-desc">${hasBridge ? t('В один день открыл секрет на сайте и в приложении') : t('Найди пасхалки и на сайте, и в приложении в один день')}</div>
          ${hasBridge ? "" : easterProgressHtml(bridgePlatformsToday, 2)}
          ${hasBridge ? `<div class="easter-hint">${t('🎊 CybLight на обоих берегах!')}</div>` : `<div class="easter-hint">${t('💡 Подсказка: исследуй сайт и приложение в один день')}</div>`}
        </div>

        ${renderFormatMirrorEasterCard(user.easter)}
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
