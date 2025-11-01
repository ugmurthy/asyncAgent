/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { GoalParams } from './GoalParams';
import type { GoalStatus } from './GoalStatus';
export type UpdateGoalRequest = {
    /**
     * Updated goal objective
     */
    objective?: string;
    params?: GoalParams;
    /**
     * Updated webhook URL
     */
    webhookUrl?: string | null;
    status?: GoalStatus;
};

