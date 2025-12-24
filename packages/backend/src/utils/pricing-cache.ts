import { logger } from '../util/logger.js';

export interface ModelPricing {
  prompt: number;
  completion: number;
}

let pricingCache: Map<string, ModelPricing> | null = null;
let lastFetchTime: number = 0;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function fetchPricing(): Promise<Map<string, ModelPricing>> {
  const now = Date.now();
  
  if (pricingCache && (now - lastFetchTime) < CACHE_TTL_MS) {
    return pricingCache;
  }

  try {
    const res = await fetch('https://openrouter.ai/api/v1/models');
    if (!res.ok) {
      logger.warn({ status: res.status }, 'Failed to fetch pricing from OpenRouter');
      return pricingCache ?? new Map();
    }

    const { data } = await res.json() as { data: Array<{ id: string; pricing?: { prompt?: string; completion?: string } }> };
    
    pricingCache = new Map();
    for (const model of data) {
      pricingCache.set(model.id, {
        prompt: parseFloat(model.pricing?.prompt ?? '0'),
        completion: parseFloat(model.pricing?.completion ?? '0'),
      });
    }

    lastFetchTime = now;
    logger.info({ modelCount: pricingCache.size }, 'Pricing cache updated from OpenRouter');
    
    return pricingCache;
  } catch (error) {
    logger.error({ err: error }, 'Error fetching pricing from OpenRouter');
    return pricingCache ?? new Map();
  }
}

export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
  pricing: Map<string, ModelPricing>
): number | null {
  const p = pricing.get(model);
  if (!p) return null;
  return promptTokens * p.prompt + completionTokens * p.completion;
}

export function clearPricingCache(): void {
  pricingCache = null;
  lastFetchTime = 0;
}
