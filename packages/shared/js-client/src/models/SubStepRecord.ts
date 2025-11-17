/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type SubStepRecord = {
    id: string;
    executionId: string;
    taskId: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'blocked' | 'waiting';
    result?: Record<string, any> | null;
    error?: string | null;
    durationMs?: number | null;
    createdAt: string;
    updatedAt?: string | null;
};

