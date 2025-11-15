const ERROR_OVERRIDES: Record<string, string> = {
  'you are not yet allowed to perform this action. please contact support.':
    'Demo mode - This feature is limited while we complete licensing. Contact licensing@resomix.com for a private demo.',
  'not authenticated': 'This operation requires you to log in first.',
};

/**
 * Normalizes playlist-related error messages and returns a mapped override when available.
 */
export function mapPlaylistErrorMessage(error: unknown, fallback?: string): string {
  if (error === null || error === undefined) {
    return fallback ?? 'An unexpected error occurred.';
  }

  const raw = String(error);
  const normalizedKey = raw.replace(/\s+/g, ' ').trim().toLowerCase();

  if (!normalizedKey) {
    return fallback ?? 'An unexpected error occurred.';
  }

  const trimmedRaw = raw.trim();
  if (ERROR_OVERRIDES[normalizedKey]) {
    return ERROR_OVERRIDES[normalizedKey];
  }
  if (trimmedRaw) {
    return trimmedRaw;
  }
  return fallback ?? 'An unexpected error occurred.';
}


