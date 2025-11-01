/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { RunStatus } from './RunStatus';
export type Run = {
    /**
     * Unique run identifier
     */
    id: string;
    /**
     * Associated goal ID
     */
    goalId: string;
    status: RunStatus;
    /**
     * ISO 8601 timestamp
     */
    startedAt?: string | null;
    /**
     * ISO 8601 timestamp
     */
    endedAt?: string | null;
    /**
     * Agent's working memory during execution
     */
    workingMemory: Record<string, any>;
    /**
     * Maximum steps allowed
     */
    stepBudget: number;
    /**
     * Number of steps executed
     */
    stepsExecuted: number;
    /**
     * Error message if run failed
     */
    error?: string | null;
    /**
     * ISO 8601 timestamp
     */
    createdAt: string;
};

