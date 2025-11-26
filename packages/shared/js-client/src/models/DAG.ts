/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type DAG = {
    /**
     * Unique DAG identifier
     */
    id: string;
    /**
     * DAG status
     */
    status: string;
    /**
     * DAG decomposition result
     */
    result?: Record<string, any> | null;
    /**
     * LLM usage statistics
     */
    usage?: Record<string, any> | null;
    /**
     * Generation statistics
     */
    generationStats?: Record<string, any> | null;
    /**
     * Number of generation attempts
     */
    attempts: number;
    /**
     * Parameters used to create the DAG
     */
    params?: Record<string, any> | null;
    /**
     * Name of the agent used
     */
    agentName?: string | null;
    /**
     * Generated title for the DAG from TitleMaster agent
     */
    dagTitle?: string | null;
    /**
     * Optional cron expression for scheduled execution (e.g., "0 9 * * *" for daily at 9am)
     */
    cronSchedule?: string | null;
    /**
     * Whether the cron schedule is active
     */
    scheduleActive?: boolean;
    createdAt: string;
    updatedAt: string;
};

