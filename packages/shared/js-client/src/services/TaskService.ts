/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise.js';
import type { BaseHttpRequest } from '../core/BaseHttpRequest.js';
export class TaskService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Execute an agent task
     * Execute a task using an agent with multipart file upload support
     * @returns any Task executed successfully
     * @throws ApiError
     */
    public executeTask({
        formData,
    }: {
        formData: {
            /**
             * Name of the agent/task to execute
             */
            taskName: string;
            /**
             * The prompt/instruction for the agent
             */
            prompt: string;
            /**
             * JSON string with optional parameters (max_tokens, temperature, reasoning_effort)
             */
            params?: string;
            /**
             * Files to attach to the task
             */
            files?: Array<Blob>;
        },
    }): CancelablePromise<{
        taskName: string;
        agentName: string;
        agentVersion: string;
        inputFiles?: Array<{
            filename?: string;
            mimeType?: string;
        }>;
        response: string;
        usage?: {
            promptTokens?: number;
            completionTokens?: number;
            totalTokens?: number;
        };
        finishReason?: string;
        reasoning?: string;
        params?: {
            provider?: string;
            model?: string;
            max_tokens?: number;
            temperature?: number;
            reasoning_effort?: 'low' | 'medium' | 'high';
        };
    }> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/v1/task',
            formData: formData,
            mediaType: 'multipart/form-data',
            errors: {
                400: `Bad Request - validation error`,
                404: `Agent not found`,
                500: `Internal server error`,
            },
        });
    }
}
