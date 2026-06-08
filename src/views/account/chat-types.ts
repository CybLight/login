/**
 * Chat-related types and constants
 */

export type PinnedMessageState = {
  messageId: string;
  text: string;
};

export type ReplyMessageState = {
  messageId: string;
  author: string;
  text: string;
};
