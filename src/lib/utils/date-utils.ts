export function formatDistanceToNow(date: string | Date): string {
  if (!date) return 'Unknown';

  const now = new Date();
  const then = new Date(date);

  if (isNaN(then.getTime())) {
    console.error('Invalid date:', date);
    return 'Invalid date';
  }

  let seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  // Handle clock drift: treat timestamps within 1 hour in the future as "just now"
  // This accounts for server clock synchronization issues
  if (seconds < 0) {
    if (seconds < -3600) {
      // More than 1 hour in the future - likely a real issue
      return 'in the future';
    }
    // Within 1 hour in the future - treat as "just now" (clock drift tolerance)
    seconds = 0;
  }

  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds} seconds ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;

  const hours = Math.floor(seconds / 3600);
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;

  const days = Math.floor(seconds / 86400);
  if (days < 7) return days === 1 ? '1 day ago' : `${days} days ago`;

  const weeks = Math.floor(seconds / 604800);
  if (weeks < 4) return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;

  const months = Math.floor(seconds / 2592000);
  if (months < 12) return months === 1 ? '1 month ago' : `${months} months ago`;

  const years = Math.floor(seconds / 31536000);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours} hours`;
}
