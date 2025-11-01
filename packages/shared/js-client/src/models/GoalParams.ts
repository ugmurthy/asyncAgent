/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type GoalParams = {
    /**
     * Maximum number of steps allowed
     */
    stepBudget?: number;
    /**
     * List of tools the agent can use
     */
    allowedTools?: Array<string>;
    /**
     * Additional constraints for the goal
     */
    constraints?: Record<string, any>;
};

