/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { DecomposerJob } from './DecomposerJob.js';
export type CreateDAGClarificationResponse = {
    status: 'clarification_required';
    /**
     * The question that needs to be answered
     */
    clarification_query: string;
    result?: DecomposerJob;
    usage?: Record<string, any> | null;
    generation_stats?: Record<string, any> | null;
};

