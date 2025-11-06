/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { GoalParams } from './GoalParams.js';
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
    /**
     * Optional agent name to use for this goal (uses active version)
     */
    agentName?: string;
    /**
     * Optional specific agent ID to use for this goal
     */
    agentId?: string;
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

