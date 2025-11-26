/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CreateDAGRequest = {
    /**
     * The goal description to decompose
     */
    'goal-text': string;
    /**
     * Name of the agent to use
     */
    agentName: string;
    /**
     * Optional LLM provider override
     */
    provider?: string;
    /**
     * Optional LLM model override
     */
    model?: string;
    /**
     * Maximum tokens for LLM response
     */
    max_tokens?: number;
    /**
     * LLM temperature (0-2)
     */
    temperature?: number;
    /**
     * Random seed for reproducibility
     */
    seed?: number;
    /**
     * Optional cron expression for scheduled execution (e.g., "0 9 * * *" for daily at 9am)
     */
    cronSchedule?: string;
    /**
     * Whether to activate the cron schedule
     */
    scheduleActive?: boolean;
};

