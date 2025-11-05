<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import { NAV_ITEMS } from '$lib/utils/constants';
	import { notifications } from '$lib/stores/notifications';
	
	let mobileMenuOpen = false;
	
	function toggleMobileMenu() {
		mobileMenuOpen = !mobileMenuOpen;
	}
	
	function closeMobileMenu() {
		mobileMenuOpen = false;
	}
</script>

<div class="min-h-screen bg-gray-50">
	<!-- Navigation -->
	<nav class="bg-white border-b border-gray-200">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="flex justify-between h-16">
				<div class="flex">
					<!-- Logo -->
					<div class="flex-shrink-0 flex items-center">
						<a href="/" class="text-xl font-bold text-primary">
							AsyncAgent
						</a>
					</div>
					
					<!-- Desktop Navigation -->
					<div class="hidden sm:ml-6 sm:flex sm:space-x-8">
						{#each NAV_ITEMS as item}
							<a
								href={item.path}
								class="inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium {$page.url.pathname === item.path
									? 'border-primary text-gray-900'
									: 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
							>
								{item.name}
							</a>
						{/each}
					</div>
				</div>
				
				<!-- Mobile menu button -->
				<div class="flex items-center sm:hidden">
					<button
						type="button"
						class="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
						on:click={toggleMobileMenu}
					>
						<span class="sr-only">Open main menu</span>
						<svg
							class="h-6 w-6"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d={mobileMenuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'}
							/>
						</svg>
					</button>
				</div>
			</div>
		</div>

		<!-- Mobile menu -->
		{#if mobileMenuOpen}
			<div class="sm:hidden">
				<div class="pt-2 pb-3 space-y-1">
					{#each NAV_ITEMS as item}
						<a
							href={item.path}
							on:click={closeMobileMenu}
							class="block pl-3 pr-4 py-2 border-l-4 text-base font-medium {$page.url.pathname === item.path
								? 'bg-primary-50 border-primary text-primary'
								: 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'}"
						>
							{item.name}
						</a>
					{/each}
				</div>
			</div>
		{/if}
	</nav>

	<!-- Main Content -->
	<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
		<slot />
	</main>

	<!-- Toast Notifications -->
	{#if $notifications.length > 0}
		<div class="fixed bottom-0 right-0 p-4 space-y-2 z-50">
			{#each $notifications as notification (notification.id)}
				<div
					class="max-w-sm w-full shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden {notification.type === 'success'
						? 'bg-green-50 border-green-200'
						: notification.type === 'error'
							? 'bg-red-50 border-red-200'
							: notification.type === 'warning'
								? 'bg-yellow-50 border-yellow-200'
								: 'bg-blue-50 border-blue-200'}"
				>
					<div class="p-4">
						<div class="flex items-start">
							<div class="flex-1">
								<p
									class="text-sm font-medium {notification.type === 'success'
										? 'text-green-800'
										: notification.type === 'error'
											? 'text-red-800'
											: notification.type === 'warning'
												? 'text-yellow-800'
												: 'text-blue-800'}"
								>
									{notification.message}
								</p>
							</div>
							<button
								type="button"
								class="ml-4 flex-shrink-0 inline-flex text-gray-400 hover:text-gray-500"
								on:click={() => notifications.remove(notification.id)}
							>
								<span class="sr-only">Close</span>
								<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
									<path
										fill-rule="evenodd"
										d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
										clip-rule="evenodd"
									/>
								</svg>
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
