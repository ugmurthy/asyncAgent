/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { GoalParams } from './GoalParams.js';
import type { GoalStatus } from './GoalStatus.js';
export type Goal = {
    /**
     * Unique goal identifier
     */
    id: string;
    /**
     * The goal objective description
     */
    objective: string;
    params: GoalParams;
    /**
     * Optional webhook URL for notifications
     */
    webhookUrl?: string | null;
    /**
     * ID of the agent assigned to this goal
     */
    agentId?: string | null;
    status: GoalStatus;
    /**
     * ISO 8601 timestamp
     */
    createdAt: string;
    /**
     * ISO 8601 timestamp
     */
    updatedAt: string;
};

