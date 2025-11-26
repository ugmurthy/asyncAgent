/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type UpdateDAGRequest = {
    /**
     * Updated status
     */
    status?: string;
    /**
     * Updated result
     */
    result?: Record<string, any>;
    /**
     * Updated params
     */
    params?: Record<string, any>;
    /**
     * Updated DAG title
     */
    dagTitle?: string;
    /**
     * Updated cron schedule expression
     */
    cronSchedule?: string;
    /**
     * Whether to activate/deactivate the schedule
     */
    scheduleActive?: boolean;
};

