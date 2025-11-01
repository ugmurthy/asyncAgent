/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Goal } from './Goal';
import type { Schedule } from './Schedule';
export type GoalWithSchedules = (Goal & {
    /**
     * Associated schedules
     */
    schedules: Array<Schedule>;
});

