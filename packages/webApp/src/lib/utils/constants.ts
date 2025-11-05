// Goal status types
export const GOAL_STATUS = {
	ACTIVE: 'active',
	PAUSED: 'paused',
	COMPLETED: 'completed'
} as const;

// Run status types
export const RUN_STATUS = {
	PENDING: 'pending',
	RUNNING: 'running',
	COMPLETED: 'completed',
	FAILED: 'failed'
} as const;

// Status color mappings
export const GOAL_STATUS_COLORS = {
	active: 'bg-green-100 text-green-800 border-green-200',
	paused: 'bg-yellow-100 text-yellow-800 border-yellow-200',
	completed: 'bg-blue-100 text-blue-800 border-blue-200'
} as const;

export const RUN_STATUS_COLORS = {
	pending: 'bg-gray-100 text-gray-800 border-gray-200',
	running: 'bg-blue-100 text-blue-800 border-blue-200',
	completed: 'bg-green-100 text-green-800 border-green-200',
	failed: 'bg-red-100 text-red-800 border-red-200'
} as const;

// Navigation items
export const NAV_ITEMS = [
	{ name: 'Dashboard', path: '/', icon: 'dashboard' },
	{ name: 'Goals', path: '/goals', icon: 'target' },
	{ name: 'Runs', path: '/runs', icon: 'play' },
	{ name: 'Settings', path: '/settings', icon: 'settings' }
] as const;

// Polling intervals
export const POLLING_INTERVAL = {
	RUNS: 5000, // 5 seconds
	DASHBOARD: 10000 // 10 seconds
} as const;
