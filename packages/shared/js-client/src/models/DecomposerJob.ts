/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { SubTask } from './SubTask.js';
export type DecomposerJob = {
    original_request: string;
    intent: {
        primary: string;
        sub_intents: Array<string>;
    };
    entities: Array<{
        entity: string;
        type: string;
        grounded_value: string;
    }>;
    sub_tasks: Array<SubTask>;
    synthesis_plan: string;
    validation: {
        coverage: string;
        gaps: Array<string>;
        iteration_triggers: Array<string>;
    };
    clarification_needed: boolean;
    clarification_query?: string | null;
};

