/**
 * TypeScript type definitions for CybLight Login
 */

// ===== User & Profile =====
export interface User {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
  avatar?: string;
  role: 'user' | 'moderator' | 'admin';
  flags: string[];
  roleNotice?: string | null;
  twoFactorEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  easter?: UserEasterFlags;
}

export interface UserProfile {
  id: string;
  username: string;
  avatar?: string;
  bio?: string;
  aboutMe?: string;
  role: string;
  flags: string[];
  twoFactorEnabled?: boolean;
  verified?: boolean;
  createdAt: string;
  friendsCount: number;
  gender?: 'male' | 'female' | 'not_specified';
  dateOfBirth?: string;
  canChangeUsername?: boolean;
  isOnline?: boolean;
  lastSeenAt?: number | null;
}

export interface EditableProfile {
  avatar?: string;
  bio?: string | null;
  aboutMe?: string | null;
  gender?: string;
  dateOfBirth?: string | null;
  privacy?: {
    avatar?: string;
    bio?: string;
    about?: string;
    gender?: string;
    dob?: string;
  };
}

// ===== Authentication =====
export interface AuthResponse {
  ok: boolean;
  user?: User;
  message?: string;
  error?: string;
}

export interface SessionCheckResponse {
  ok: boolean;
  user?: User;
}

// ===== Friends & Friendship =====
export interface Friend {
  id: string;
  username: string;
  avatar?: string;
  status: 'accepted' | 'pending' | 'blocked';
}

export interface FriendshipStatus {
  status: 'accepted' | 'pending' | 'blocked' | null;
}

// ===== Messages & Chat =====
export interface ChatMessage {
  id: string;
  senderId: string;
  senderUsername: string;
  recipientId: string;
  content: string;
  contentFormatted?: string;
  reactions: Record<string, string[]>;
  createdAt: string;
  updatedAt: string;
  editedAt?: string;
  readAt?: number | string | null;
  deleted?: boolean;
}

export interface MessageReaction {
  emoji: string;
  usernames: string[];
}

// ===== Sessions =====
export interface LoginSession {
  id: string;
  userAgent: string;
  ipAddress: string;
  lastActivity: string;
  createdAt: string;
  isCurrent?: boolean;
  browser?: string;
  os?: string;
  device?: string;
}

// ===== 2FA =====
export interface TwoFactorSetup {
  secret: string;
  qrCode: string;
}

// ===== API Responses =====
export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ===== Device Info =====
export interface ParsedUA {
  os: string;
  browser: string;
  version: string;
  type: 'phone' | 'tablet' | 'pc';
  device: string;
  model: string;
  isApp: boolean;
}

export interface DeviceSession extends LoginSession {
  parsedUA?: ParsedUA;
}

// ===== Validation Results =====
export interface PasswordStrength {
  lowercase: boolean;
  uppercase: boolean;
  numbers: boolean;
  special: boolean;
  length: boolean;
  score: number; // 0-5
}

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

// ===== Form States =====
export interface SignupFormData {
  username: string;
  email: string;
  password: string;
  passwordConfirm: string;
  captchaToken: string;
}

export interface LoginFormData {
  username: string;
  password: string;
  captchaToken: string;
}

export interface PasswordResetFormData {
  email: string;
  newPassword: string;
  newPasswordConfirm: string;
  code: string;
  captchaToken: string;
}

// ===== UI Components =====
export interface NotificationOptions {
  type: 'success' | 'error' | 'warn' | 'info';
  message: string;
  duration?: number;
}

export interface ModalOptions {
  title: string;
  text: string;
  onOk?: () => void | Promise<void>;
}

export interface LightboxOptions {
  sources: string[];
  captions?: string[];
  startIndex?: number;
}

// ===== Shared view / API shapes =====
export interface FriendListItem {
  id?: string;
  username?: string;
  avatar?: string;
  avatarUrl?: string;
  avatar_url?: string;
  avatarId?: string;
  avatar_id?: string;
  createdAt?: string | number;
  isOnline?: boolean;
  lastSeenAt?: number | null;
  last_seen_at?: number | null;
}

export interface UserEasterFlags {
  strawberry?: boolean;
  darkTrigger?: boolean;
  dark_trigger?: boolean;
  profileMirror?: boolean;
  profile_mirror?: boolean;
  lightCatcher?: boolean;
  light_catcher?: boolean;
  postmaster?: boolean;
  developerMode?: boolean;
  developer_mode?: boolean;
  themeFlux?: boolean;
  theme_flux?: boolean;
  nightGuard?: boolean;
  night_guard?: boolean;
  trustedFingerprint?: boolean;
  trusted_fingerprint?: boolean;
  bridge?: boolean;
  bridgeWebToday?: boolean;
  bridge_web_today?: boolean;
  bridgeAppToday?: boolean;
  bridge_app_today?: boolean;
  echo?: boolean;
  archivist?: boolean;
}

export interface EasterLoginPayload {
  easter?: UserEasterFlags;
  user?: {
    easter?: UserEasterFlags;
    flags?: string[];
  };
  flags?: string[];
}

export interface PasskeyItem {
  id: string;
  name: string;
  createdAt?: string | number;
  lastUsedAt?: string | number;
}

export interface TrustedDeviceItem {
  id: string;
  createdAt?: string | number;
  lastUsedAt?: string | number;
  ipAddress?: string;
  userAgent?: string;
}

export interface LoginHistoryItem {
  createdAt?: string | number;
  action?: string;
  ip?: string;
  userAgent?: string;
}

export interface UnreadMapRow {
  sender_id?: string | number;
  senderId?: string | number;
  user_id?: string | number;
  userId?: string | number;
  unread_count?: number;
  unreadCount?: number;
  count?: number;
}

export interface MicrolinkData {
  url?: string;
  title?: string;
  description?: string;
  image?: { url?: string };
  logo?: { url?: string };
  publisher?: string;
  author?: string;
}

export interface ApiOkResponse {
  ok?: boolean;
  error?: string;
  message?: string;
}

export interface SessionListItem {
  id: string;
  user_agent?: string;
  browser?: string;
  os?: string;
  device?: string;
  device_name?: string;
  model?: string;
  city?: string;
  region?: string;
  country?: string;
  colo?: string;
  created_at?: string | number;
  last_seen_at?: string | number;
}

export interface WebAuthnCredentialDescriptorInput {
  id: string;
  type?: PublicKeyCredentialType;
  transports?: AuthenticatorTransport[];
}

