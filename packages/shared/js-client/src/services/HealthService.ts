/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { HealthResponse } from '../models/HealthResponse';
import type { ReadinessResponse } from '../models/ReadinessResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class HealthService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Get health status
     * Returns basic health status of the API
     * @returns HealthResponse API is healthy
     * @throws ApiError
     */
    public getHealth(): CancelablePromise<HealthResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/health',
        });
    }
    /**
     * Get readiness status
     * Returns detailed readiness status including LLM provider and scheduler info
     * @returns ReadinessResponse API is ready
     * @throws ApiError
     */
    public getHealthReady(): CancelablePromise<ReadinessResponse> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/health/ready',
        });
    }
}
