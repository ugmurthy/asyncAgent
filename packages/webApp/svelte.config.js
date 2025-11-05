import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter(),
		alias: {
			'$lib': './src/lib',
			'$components': './src/lib/components',
			'$ui': './src/lib/ui',
			'$stores': './src/lib/stores',
			'$utils': './src/lib/utils'
		}
	}
};

export default config;
