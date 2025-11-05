import { AsyncAgentClient } from '@async-agent/api-js-client';
import { browser } from '$app/environment';

// Get base URL from environment or default
const getBaseUrl = (): string => {
	if (browser) {
		return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
	}
	// Server-side: use localhost
	return process.env.API_BASE_URL || 'http://localhost:3000';
};

// Create singleton API client instance
export const apiClient = new AsyncAgentClient({
	BASE: getBaseUrl()
});

// Export individual services for convenience
export const { goals, runs, agents, health } = apiClient;
