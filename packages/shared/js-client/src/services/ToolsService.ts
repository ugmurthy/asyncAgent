/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ToolDefinition } from '../models/ToolDefinition.js';
import type { CancelablePromise } from '../core/CancelablePromise.js';
import type { BaseHttpRequest } from '../core/BaseHttpRequest.js';
export class ToolsService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * List all tools or get specific tool
     * Retrieve all tool definitions or a specific tool by name
     * @returns any Tool definitions
     * @throws ApiError
     */
    public listTools({
        name,
    }: {
        /**
         * Filter tools by name (returns single tool if found)
         */
        name?: string,
    }): CancelablePromise<(Array<ToolDefinition> | ToolDefinition)> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/tools',
            query: {
                'name': name,
            },
            errors: {
                404: `Resource not found`,
                500: `Internal server error`,
            },
        });
    }
}
