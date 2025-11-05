/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateGoalRequest } from '../models/CreateGoalRequest.js';
import type { Goal } from '../models/Goal.js';
import type { GoalStatus } from '../models/GoalStatus.js';
import type { GoalWithSchedules } from '../models/GoalWithSchedules.js';
import type { MessageResponse } from '../models/MessageResponse.js';
import type { TriggerRunResponse } from '../models/TriggerRunResponse.js';
import type { UpdateGoalRequest } from '../models/UpdateGoalRequest.js';
import type { CancelablePromise } from '../core/CancelablePromise.js';
import type { BaseHttpRequest } from '../core/BaseHttpRequest.js';
export class GoalsService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * List all goals
     * Retrieve all goals with optional status filtering
     * @returns GoalWithSchedules List of goals
     * @throws ApiError
     */
    public listGoals({
        status,
    }: {
        /**
         * Filter goals by status
         */
        status?: GoalStatus,
    }): CancelablePromise<Array<GoalWithSchedules>> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/goals',
            query: {
                'status': status,
            },
            errors: {
                400: `Bad Request - validation error`,
                429: `Too many requests - rate limit exceeded`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Create a new goal
     * Create a new goal with optional schedule configuration
     * @returns Goal Goal created successfully
     * @throws ApiError
     */
    public createGoal({
        requestBody,
    }: {
        requestBody: CreateGoalRequest,
    }): CancelablePromise<Goal> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/v1/goals',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Bad Request - validation error`,
                429: `Too many requests - rate limit exceeded`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get goal by ID
     * Retrieve a specific goal with its schedules
     * @returns GoalWithSchedules Goal details
     * @throws ApiError
     */
    public getGoal({
        id,
    }: {
        /**
         * Goal ID (format goal_xxxxx)
         */
        id: string,
    }): CancelablePromise<GoalWithSchedules> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/goals/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `Resource not found`,
                429: `Too many requests - rate limit exceeded`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Update goal
     * Update goal properties (objective, params, webhookUrl, status)
     * @returns Goal Goal updated successfully
     * @throws ApiError
     */
    public updateGoal({
        id,
        requestBody,
    }: {
        /**
         * Goal ID (format goal_xxxxx)
         */
        id: string,
        requestBody: UpdateGoalRequest,
    }): CancelablePromise<Goal> {
        return this.httpRequest.request({
            method: 'PATCH',
            url: '/api/v1/goals/{id}',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Bad Request - validation error`,
                404: `Resource not found`,
                429: `Too many requests - rate limit exceeded`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Delete goal
     * Delete a goal and all its associated schedules and runs
     * @returns void
     * @throws ApiError
     */
    public deleteGoal({
        id,
    }: {
        /**
         * Goal ID (format goal_xxxxx)
         */
        id: string,
    }): CancelablePromise<void> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/api/v1/goals/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `Resource not found`,
                429: `Too many requests - rate limit exceeded`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Trigger goal run
     * Manually trigger a goal execution
     * @returns TriggerRunResponse Run triggered successfully
     * @throws ApiError
     */
    public triggerGoalRun({
        id,
        requestBody,
    }: {
        /**
         * Goal ID (format goal_xxxxx)
         */
        id: string,
        requestBody: Record<string, any>,
    }): CancelablePromise<TriggerRunResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/v1/goals/{id}/run',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                404: `Resource not found`,
                429: `Too many requests - rate limit exceeded`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Pause goal
     * Pause a goal and deactivate its schedules
     * @returns MessageResponse Goal paused successfully
     * @throws ApiError
     */
    public pauseGoal({
        id,
        requestBody,
    }: {
        /**
         * Goal ID (format goal_xxxxx)
         */
        id: string,
        requestBody: Record<string, any>,
    }): CancelablePromise<MessageResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/v1/goals/{id}/pause',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                404: `Resource not found`,
                429: `Too many requests - rate limit exceeded`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Resume goal
     * Resume a paused goal and reactivate its schedules
     * @returns MessageResponse Goal resumed successfully
     * @throws ApiError
     */
    public resumeGoal({
        id,
        requestBody,
    }: {
        /**
         * Goal ID (format goal_xxxxx)
         */
        id: string,
        requestBody: Record<string, any>,
    }): CancelablePromise<MessageResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/v1/goals/{id}/resume',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                404: `Resource not found`,
                429: `Too many requests - rate limit exceeded`,
                500: `Internal server error`,
            },
        });
    }
}
