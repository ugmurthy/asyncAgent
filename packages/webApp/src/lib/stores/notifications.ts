import { writable } from 'svelte/store';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
	id: string;
	type: NotificationType;
	message: string;
	timeout?: number;
}

function createNotificationStore() {
	const { subscribe, update } = writable<Notification[]>([]);

	return {
		subscribe,
		add: (message: string, type: NotificationType = 'info', timeout: number = 5000) => {
			const id = `notification-${Date.now()}-${Math.random()}`;
			const notification: Notification = { id, message, type, timeout };

			update((notifications) => [...notifications, notification]);

			if (timeout > 0) {
				setTimeout(() => {
					update((notifications) => notifications.filter((n) => n.id !== id));
				}, timeout);
			}

			return id;
		},
		remove: (id: string) => {
			update((notifications) => notifications.filter((n) => n.id !== id));
		},
		clear: () => {
			update(() => []);
		}
	};
}

export const notifications = createNotificationStore();

// Helper function for backward compatibility
export function addNotification(message: string, type: NotificationType = 'info') {
	notifications.add(message, type);
}
