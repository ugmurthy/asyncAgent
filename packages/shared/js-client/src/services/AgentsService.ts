/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Agent } from '../models/Agent.js';
import type { CreateAgentRequest } from '../models/CreateAgentRequest.js';
import type { CancelablePromise } from '../core/CancelablePromise.js';
import type { BaseHttpRequest } from '../core/BaseHttpRequest.js';
export class AgentsService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * List all agents
     * Retrieve all agents with optional filtering by name or active status
     * @returns Agent List of agents
     * @throws ApiError
     */
    public listAgents({
        name,
        active,
    }: {
        /**
         * Filter agents by name
         */
        name?: string,
        /**
         * Filter agents by active status
         */
        active?: 'true' | 'false',
    }): CancelablePromise<Array<Agent>> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/agents',
            query: {
                'name': name,
                'active': active,
            },
            errors: {
                400: `Bad Request - validation error`,
                429: `Too many requests - rate limit exceeded`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Create a new agent
     * Register a new agent version with name, version, and prompt template
     * @returns Agent Agent created successfully
     * @throws ApiError
     */
    public createAgent({
        requestBody,
    }: {
        requestBody: CreateAgentRequest,
    }): CancelablePromise<Agent> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/v1/agents',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Bad Request - validation error`,
                409: `Agent with this name and version already exists`,
                429: `Too many requests - rate limit exceeded`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get agent by ID
     * Retrieve a specific agent by its ID
     * @returns Agent Agent details
     * @throws ApiError
     */
    public getAgent({
        id,
    }: {
        /**
         * Agent ID (format agent_xxxxx)
         */
        id: string,
    }): CancelablePromise<Agent> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/agents/{id}',
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
     * Delete agent
     * Delete a specific agent (must not be active)
     * @returns void
     * @throws ApiError
     */
    public deleteAgent({
        id,
    }: {
        /**
         * Agent ID (format agent_xxxxx)
         */
        id: string,
    }): CancelablePromise<void> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/api/v1/agents/{id}',
            path: {
                'id': id,
            },
            errors: {
                400: `Cannot delete active agent`,
                404: `Resource not found`,
                429: `Too many requests - rate limit exceeded`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Activate an agent
     * Activate an agent and deactivate other versions with the same name
     * @returns Agent Agent activated successfully
     * @throws ApiError
     */
    public activateAgent({
        id,
        requestBody,
    }: {
        /**
         * Agent ID (format agent_xxxxx)
         */
        id: string,
        requestBody?: Record<string, any>,
    }): CancelablePromise<Agent> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/v1/agents/{id}/activate',
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
     * Resolve active agent by name
     * Get the currently active agent for a given name
     * @returns Agent Active agent found
     * @throws ApiError
     */
    public resolveAgent({
        name,
    }: {
        /**
         * Agent name
         */
        name: string,
    }): CancelablePromise<Agent> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/agents/resolve/{name}',
            path: {
                'name': name,
            },
            errors: {
                404: `No active agent found with this name`,
                429: `Too many requests - rate limit exceeded`,
                500: `Internal server error`,
            },
        });
    }
}
