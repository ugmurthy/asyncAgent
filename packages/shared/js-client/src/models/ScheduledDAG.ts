/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ScheduledDAG = {
    /**
     * Unique DAG identifier
     */
    id: string;
    /**
     * Generated title for the DAG
     */
    dag_title?: string | null;
    /**
     * Cron expression for scheduled execution
     */
    cron_schedule: string;
    /**
     * Human-readable description of the cron schedule
     */
    schedule_description?: string;
    /**
     * Whether the cron schedule is active
     */
    schedule_active: boolean;
};

