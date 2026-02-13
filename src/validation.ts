/**
 * Input validation utilities
 */

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validate cron expression (5-field standard format)
 */
export function validateCronExpression(cron: string): { valid: boolean; error?: string } {
  if (!cron || typeof cron !== 'string') {
    return { valid: false, error: 'Cron expression is required' };
  }

  const trimmed = cron.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Cron expression cannot be empty' };
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length < 5 || parts.length > 6) {
    return {
      valid: false,
      error: `Invalid cron expression: expected 5 fields, got ${parts.length}\n\nExamples:\n  */5 * * * * - Every 5 minutes\n  0 9 * * * - Every day at 9 AM\n  0 9 * * 1-5 - Every weekday at 9 AM\n\nUse https://crontab.guru to build expressions.`
    };
  }

  // Basic field validation
  const fieldPattern = /^(\*|[0-9]+(-[0-9]+)?(\/[0-9]+)?)(,(\*|[0-9]+(-[0-9]+)?(\/[0-9]+)?))*$/;
  for (const part of parts) {
    if (part !== '?' && !fieldPattern.test(part)) {
      return {
        valid: false,
        error: `Invalid cron field: "${part}"\n\nUse https://crontab.guru to build expressions.`
      };
    }
  }

  return { valid: true };
}

/**
 * Validate job name
 */
export function validateJobName(name: string): { valid: boolean; error?: string } {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Job name is required' };
  }

  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Job name cannot be empty' };
  }

  if (trimmed.length > 100) {
    return { valid: false, error: 'Job name must be 100 characters or less' };
  }

  // Check for invalid characters
  if (!/^[a-zA-Z0-9\s\-_]+$/.test(trimmed)) {
    return { valid: false, error: 'Job name can only contain letters, numbers, spaces, hyphens, and underscores' };
  }

  return { valid: true };
}

/**
 * Validate message
 */
export function validateMessage(message: string): { valid: boolean; error?: string } {
  if (!message || typeof message !== 'string') {
    return { valid: false, error: 'Message is required' };
  }

  const trimmed = message.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Message cannot be empty' };
  }

  if (trimmed.length > 5000) {
    return { valid: false, error: 'Message must be 5000 characters or less' };
  }

  return { valid: true };
}

/**
 * Validate channel name
 */
export function validateChannel(channel: string): { valid: boolean; error?: string } {
  const validChannels = [
    'whatsapp',
    'telegram',
    'slack',
    'discord',
    'signal',
    'imessage',
    'googlechat',
    'mattermost',
    'matrix',
    'nostr',
    'msteams',
    'line',
    'zalo',
    'bluebubbles',
    'nextcloud-talk'
  ];

  const trimmed = channel.trim().toLowerCase();
  if (!validChannels.includes(trimmed)) {
    return {
      valid: false,
      error: `Invalid channel: ${channel}\n\nValid channels:\n  ${validChannels.join(', ')}`
    };
  }

  return { valid: true };
}

/**
 * Validate Telegram chat ID
 */
export function validateTelegramChatId(chatId: string): { valid: boolean; error?: string } {
  if (!chatId || typeof chatId !== 'string') {
    return { valid: false, error: 'Telegram chat ID is required when using Telegram channel' };
  }

  // Telegram chat IDs are numeric (positive or negative)
  if (!/^-?\d+$/.test(chatId.trim())) {
    return {
      valid: false,
      error: 'Invalid Telegram chat ID format. Must be a number.\n\nGet your chat ID from @userinfobot on Telegram.'
    };
  }

  return { valid: true };
}

/**
 * Validate phone number (E.164 format)
 */
export function validatePhoneNumber(phone: string): { valid: boolean; error?: string } {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, error: 'Phone number is required' };
  }

  // E.164 format: +[country code][number] (e.g., +15555551234)
  if (!/^\+[1-9]\d{1,14}$/.test(phone.trim())) {
    return {
      valid: false,
      error: 'Invalid phone number format. Must be in E.164 format (e.g., +15555551234)'
    };
  }

  return { valid: true };
}

/**
 * Validate agent ID
 */
export function validateAgentId(agentId: string): { valid: boolean; error?: string } {
  if (!agentId || typeof agentId !== 'string') {
    return { valid: false, error: 'Agent ID is required' };
  }

  const trimmed = agentId.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Agent ID cannot be empty' };
  }

  if (trimmed.length > 50) {
    return { valid: false, error: 'Agent ID must be 50 characters or less' };
  }

  return { valid: true };
}

/**
 * Validate job ID format
 */
export function validateJobId(jobId: string): { valid: boolean; error?: string } {
  if (!jobId || typeof jobId !== 'string') {
    return { valid: false, error: 'Job ID is required' };
  }

  const trimmed = jobId.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Job ID cannot be empty' };
  }

  // Job IDs are in format: timestamp-randomstring
  if (!/^\d+-[a-z0-9]+$/.test(trimmed)) {
    return {
      valid: false,
      error: 'Invalid job ID format. Use "clawtick list" to see valid job IDs.'
    };
  }

  return { valid: true };
}
