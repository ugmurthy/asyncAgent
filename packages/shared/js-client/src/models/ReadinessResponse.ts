/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ReadinessResponse = {
    status: 'ready';
    /**
     * LLM provider name
     */
    provider: string;
    /**
     * LLM model name
     */
    model: string;
    scheduler: {
        /**
         * Number of active schedules
         */
        activeSchedules: number;
    };
    timestamp: string;
};

