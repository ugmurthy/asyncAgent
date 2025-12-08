/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CreateAndExecuteDAGResponse = {
    status: 'executing';
    /**
     * The created DAG ID
     */
    dagId: string;
    /**
     * The execution ID for tracking
     */
    executionId: string;
    /**
     * The original goal text
     */
    originalRequest: string;
    /**
     * Number of sub-tasks to execute
     */
    totalTasks: number;
    /**
     * LLM usage statistics
     */
    usage?: Record<string, any> | null;
    /**
     * Generation statistics
     */
    generation_stats?: Record<string, any> | null;
    /**
     * Information message about the execution
     */
    message: string;
};

