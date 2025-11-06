/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { RunStatus } from '../models/RunStatus.js';
import type { RunWithGoal } from '../models/RunWithGoal.js';
import type { Step } from '../models/Step.js';
import type { CancelablePromise } from '../core/CancelablePromise.js';
import type { BaseHttpRequest } from '../core/BaseHttpRequest.js';
export class RunsService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * List all runs
     * Retrieve all runs (limited to 50 most recent) with optional goalId and status filtering
     * @returns RunWithGoal List of runs
     * @throws ApiError
     */
    public listRuns({
        goalId,
        status,
    }: {
        /**
         * Filter runs by goal ID
         */
        goalId?: string,
        /**
         * Filter runs by status
         */
        status?: RunStatus,
    }): CancelablePromise<Array<RunWithGoal>> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/runs',
            query: {
                'goalId': goalId,
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
     * Get run by ID
     * Retrieve a specific run with its associated goal
     * @returns RunWithGoal Run details
     * @throws ApiError
     */
    public getRun({
        id,
    }: {
        /**
         * Run ID (format run_xxxxx)
         */
        id: string,
    }): CancelablePromise<RunWithGoal> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/runs/{id}',
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
     * Delete run
     * Delete a specific run and all its steps
     * @returns void
     * @throws ApiError
     */
    public deleteRun({
        id,
    }: {
        /**
         * Run ID (format run_xxxxx)
         */
        id: string,
    }): CancelablePromise<void> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/api/v1/runs/{id}',
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
     * Get run steps
     * Retrieve all execution steps for a specific run
     * @returns Step List of steps
     * @throws ApiError
     */
    public getRunSteps({
        id,
    }: {
        /**
         * Run ID (format run_xxxxx)
         */
        id: string,
    }): CancelablePromise<Array<Step>> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/runs/{id}/steps',
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
}
