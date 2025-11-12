import 'dotenv/config';
import { env } from '../src/util/env.js';

console.log('Environment Variables:');
for (const [key, value] of Object.entries(env)) {
  console.log(`${key}: ${value}`);
}
