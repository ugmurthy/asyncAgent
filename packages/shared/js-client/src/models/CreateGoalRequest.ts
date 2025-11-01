/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { GoalParams } from './GoalParams';
export type CreateGoalRequest = {
    /**
     * The goal objective description
     */
    objective: string;
    params?: GoalParams;
    /**
     * Optional webhook URL for notifications
     */
    webhookUrl?: string;
    schedule?: {
        /**
         * Cron expression
         */
        cronExpr: string;
        /**
         * Timezone for schedule
         */
        timezone?: string;
    };
};

