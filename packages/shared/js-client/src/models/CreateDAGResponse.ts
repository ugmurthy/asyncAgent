/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { DecomposerJob } from './DecomposerJob.js';
export type CreateDAGResponse = {
    status: 'success' | 'clarification_required';
    result?: DecomposerJob;
    clarification_query?: string | null;
    usage?: Record<string, any> | null;
    generation_stats?: Record<string, any> | null;
    attempts?: number;
};

