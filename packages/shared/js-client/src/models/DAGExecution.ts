/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type DAGExecution = {
    id: string;
    dagId: string | null;
    status: 'pending' | 'running' | 'waiting' | 'completed' | 'failed' | 'partial' | 'suspended';
    completedTasks: number;
    failedTasks: number;
    waitingTasks: number;
    startedAt?: string | null;
    endedAt?: string | null;
    lastRetryAt?: string | null;
    retryCount: number;
    error?: string | null;
    createdAt: string;
};

