/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { GoalParams } from './GoalParams';
import type { GoalStatus } from './GoalStatus';
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

