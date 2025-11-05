/**
 * Format date to relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: string | Date): string {
	const now = new Date();
	const past = new Date(date);
	const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

	if (diffInSeconds < 60) return 'just now';
	if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
	if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
	if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
	
	return past.toLocaleDateString();
}

/**
 * Format date to human-readable string
 */
export function formatDate(date: string | Date): string {
	return new Date(date).toLocaleString();
}

/**
 * Format duration in milliseconds to readable string
 */
export function formatDuration(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
	if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
	return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

/**
 * Format goal status to display string
 */
export function formatGoalStatus(status: string): string {
	return status.charAt(0).toUpperCase() + status.slice(1);
}

/**
 * Format run status to display string
 */
export function formatRunStatus(status: string): string {
	return status.charAt(0).toUpperCase() + status.slice(1);
}

/**
 * Truncate text to max length
 */
export function truncate(text: string, maxLength: number = 100): string {
	if (text.length <= maxLength) return text;
	return text.slice(0, maxLength) + '...';
}

/**
 * Format cron expression to human-readable string
 */
export function formatCronExpression(cron: string): string {
	// Simple formatter - can be enhanced with a library later
	const parts = cron.split(' ');
	if (parts.length !== 5) return cron;
	
	const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
	
	// Daily at specific time
	if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
		return `Daily at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
	}
	
	// Weekly
	if (dayOfMonth === '*' && month === '*' && dayOfWeek !== '*') {
		const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
		return `Weekly on ${days[parseInt(dayOfWeek)]} at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
	}
	
	return cron;
}
