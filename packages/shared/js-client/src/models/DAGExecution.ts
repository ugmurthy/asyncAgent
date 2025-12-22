/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type DAGExecution = {
    /**
     * Title of the associated DAG (from dags table)
     */
    dagTitle?: string | null;
    id: string;
    dagId: string | null;
    /**
     * The original goal text/request
     */
    originalRequest?: string;
    /**
     * The primary intent derived from the request
     */
    primaryIntent?: string;
    status: 'pending' | 'running' | 'waiting' | 'completed' | 'failed' | 'partial' | 'suspended';
    /**
     * Total number of tasks in the execution
     */
    totalTasks?: number;
    completedTasks: number;
    failedTasks: number;
    waitingTasks: number;
    startedAt?: string | null;
    completedAt?: string | null;
    /**
     * Duration of execution in milliseconds
     */
    durationMs?: number | null;
    /**
     * Final result of the execution
     */
    finalResult?: string | null;
    /**
     * Synthesis result of all sub-tasks
     */
    synthesisResult?: string | null;
    /**
     * Reason for suspension if status is suspended
     */
    suspendedReason?: string | null;
    suspendedAt?: string | null;
    retryCount: number;
    lastRetryAt?: string | null;
    createdAt: string;
    updatedAt?: string | null;
};

