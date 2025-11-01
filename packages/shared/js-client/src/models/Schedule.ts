/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type Schedule = {
    /**
     * Unique schedule identifier
     */
    id: string;
    /**
     * Associated goal ID
     */
    goalId: string;
    /**
     * Cron expression for scheduling
     */
    cronExpr: string;
    /**
     * Timezone for schedule
     */
    timezone: string;
    /**
     * Whether schedule is active
     */
    active: boolean;
    /**
     * ISO 8601 timestamp
     */
    createdAt: string;
};

