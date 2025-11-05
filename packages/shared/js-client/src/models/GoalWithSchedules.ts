/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Goal } from './Goal.js';
import type { Schedule } from './Schedule.js';
export type GoalWithSchedules = (Goal & {
    /**
     * Associated schedules
     */
    schedules: Array<Schedule>;
});

