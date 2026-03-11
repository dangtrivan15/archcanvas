/**
 * Format a timestamp (in milliseconds) as a human-readable relative time string.
 * Examples: "just now", "2 minutes ago", "1 hour ago", "3 days ago"
 */
export function formatRelativeTime(timestampMs: number): string {
  const now = Date.now();
  const diffMs = now - timestampMs;

  // Future timestamps or very recent (within 30 seconds)
  if (diffMs < 30_000) {
    return 'just now';
  }

  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSeconds < 60) {
    return `${diffSeconds} seconds ago`;
  }
  if (diffMinutes === 1) {
    return '1 minute ago';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} minutes ago`;
  }
  if (diffHours === 1) {
    return '1 hour ago';
  }
  if (diffHours < 24) {
    return `${diffHours} hours ago`;
  }
  if (diffDays === 1) {
    return '1 day ago';
  }
  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }
  if (diffWeeks === 1) {
    return '1 week ago';
  }
  if (diffWeeks < 5) {
    return `${diffWeeks} weeks ago`;
  }
  if (diffMonths === 1) {
    return '1 month ago';
  }
  if (diffMonths < 12) {
    return `${diffMonths} months ago`;
  }
  if (diffYears === 1) {
    return '1 year ago';
  }
  return `${diffYears} years ago`;
}
