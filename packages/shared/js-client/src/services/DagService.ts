/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ClarificationResponse } from '../models/ClarificationResponse.js';
import type { CreateAndExecuteDAGResponse } from '../models/CreateAndExecuteDAGResponse.js';
import type { CreateDAGClarificationResponse } from '../models/CreateDAGClarificationResponse.js';
import type { CreateDAGRequest } from '../models/CreateDAGRequest.js';
import type { CreateDAGResponse } from '../models/CreateDAGResponse.js';
import type { DAG } from '../models/DAG.js';
import type { DAGExecutionList } from '../models/DAGExecutionList.js';
import type { DAGExecutionWithSteps } from '../models/DAGExecutionWithSteps.js';
import type { DAGList } from '../models/DAGList.js';
import type { DAGSubStepsList } from '../models/DAGSubStepsList.js';
import type { DeleteDAGExecutionResponse } from '../models/DeleteDAGExecutionResponse.js';
import type { ExecuteDAGResponse } from '../models/ExecuteDAGResponse.js';
import type { MessageResponse } from '../models/MessageResponse.js';
import type { ResumeDAGResponse } from '../models/ResumeDAGResponse.js';
import type { ScheduledDAG } from '../models/ScheduledDAG.js';
import type { UpdateDAGRequest } from '../models/UpdateDAGRequest.js';
import type { CancelablePromise } from '../core/CancelablePromise.js';
import type { BaseHttpRequest } from '../core/BaseHttpRequest.js';
export class DagService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Create a DAG from goal text
     * Decompose a goal into a directed acyclic graph of sub-tasks
     * @returns CreateDAGResponse DAG created successfully or clarification required
     * @throws ApiError
     */
    public createDag({
        requestBody,
    }: {
        requestBody: CreateDAGRequest,
    }): CancelablePromise<CreateDAGResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/v1/create-dag',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Bad Request - validation error`,
                404: `Resource not found`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Execute a DAG
     * Start execution of a previously created DAG
     * @returns ClarificationResponse Clarification required
     * @returns ExecuteDAGResponse DAG execution started
     * @throws ApiError
     */
    public executeDag({
        requestBody,
    }: {
        requestBody: {
            /**
             * The DAG ID to execute
             */
            dagId: string;
        },
    }): CancelablePromise<ClarificationResponse | ExecuteDAGResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/v1/execute-dag',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Bad Request - validation error`,
                404: `Resource not found`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Create and immediately execute a DAG
     * Create a DAG from goal text and immediately execute it if creation succeeds.
     * If clarification is needed, returns clarification response without executing.
     * Combines the create-dag and execute-dag operations into a single call.
     *
     * @returns CreateDAGClarificationResponse Clarification required - DAG not executed
     * @returns CreateAndExecuteDAGResponse DAG created and execution started
     * @throws ApiError
     */
    public createAndExecuteDag({
        requestBody,
    }: {
        requestBody: CreateDAGRequest,
    }): CancelablePromise<CreateDAGClarificationResponse | CreateAndExecuteDAGResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/v1/create-and-execute-dag',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Bad Request - validation error`,
                404: `Resource not found`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Resume a suspended DAG execution
     * Resume a suspended or failed DAG execution
     * @returns ResumeDAGResponse Execution resumed
     * @throws ApiError
     */
    public resumeDag({
        executionId,
    }: {
        /**
         * The execution ID to resume
         */
        executionId: string,
    }): CancelablePromise<ResumeDAGResponse> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/v1/resume-dag/{executionId}',
            path: {
                'executionId': executionId,
            },
            errors: {
                400: `Bad Request - validation error`,
                404: `Resource not found`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * List DAG executions
     * Retrieve all DAG executions with optional filtering
     * @returns DAGExecutionList List of DAG executions
     * @throws ApiError
     */
    public listDagExecutions({
        limit = 50,
        offset,
        status,
    }: {
        /**
         * Maximum number of results (default 50)
         */
        limit?: number,
        /**
         * Number of results to skip (default 0)
         */
        offset?: number,
        /**
         * Filter by execution status
         */
        status?: 'pending' | 'running' | 'waiting' | 'completed' | 'failed' | 'partial' | 'suspended',
    }): CancelablePromise<DAGExecutionList> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/dag-executions',
            query: {
                'limit': limit,
                'offset': offset,
                'status': status,
            },
            errors: {
                400: `Bad Request - validation error`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get DAG execution details
     * Retrieve a specific DAG execution with its sub-steps
     * @returns DAGExecutionWithSteps DAG execution details
     * @throws ApiError
     */
    public getDagExecution({
        id,
    }: {
        /**
         * The execution ID
         */
        id: string,
    }): CancelablePromise<DAGExecutionWithSteps> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/dag-executions/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `Resource not found`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Delete DAG execution
     * Delete a DAG execution and all its sub-steps
     * @returns DeleteDAGExecutionResponse Execution deleted successfully
     * @throws ApiError
     */
    public deleteDagExecution({
        id,
    }: {
        /**
         * The execution ID
         */
        id: string,
    }): CancelablePromise<DeleteDAGExecutionResponse> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/api/v1/dag-executions/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `Resource not found`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get DAG execution sub-steps
     * Retrieve all sub-steps for a specific DAG execution
     * @returns DAGSubStepsList List of sub-steps
     * @throws ApiError
     */
    public getDagExecutionSubSteps({
        id,
    }: {
        /**
         * The execution ID
         */
        id: string,
    }): CancelablePromise<DAGSubStepsList> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/dag-executions/{id}/sub-steps',
            path: {
                'id': id,
            },
            errors: {
                404: `Resource not found`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Stream DAG execution events
     * Server-Sent Events stream for real-time DAG execution updates
     * @returns string SSE stream with execution events
     * @throws ApiError
     */
    public streamDagExecutionEvents({
        id,
    }: {
        /**
         * The execution ID
         */
        id: string,
    }): CancelablePromise<string> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/dag-executions/{id}/events',
            path: {
                'id': id,
            },
            errors: {
                404: `Resource not found`,
            },
        });
    }
    /**
     * List all DAGs
     * Retrieve all DAGs with optional status filtering
     * @returns DAGList List of DAGs
     * @throws ApiError
     */
    public listDags({
        limit = 50,
        offset,
        status,
    }: {
        /**
         * Maximum number of results (default 50)
         */
        limit?: number,
        /**
         * Number of results to skip (default 0)
         */
        offset?: number,
        /**
         * Filter by DAG status
         */
        status?: string,
    }): CancelablePromise<DAGList> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/dags',
            query: {
                'limit': limit,
                'offset': offset,
                'status': status,
            },
            errors: {
                400: `Bad Request - validation error`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * List scheduled DAGs
     * Retrieve all DAGs that have a cron schedule configured
     * @returns ScheduledDAG List of scheduled DAGs
     * @throws ApiError
     */
    public listScheduledDags(): CancelablePromise<Array<ScheduledDAG>> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/dags/scheduled',
            errors: {
                500: `Internal server error`,
            },
        });
    }
    /**
     * Get DAG by ID
     * Retrieve a specific DAG by its ID
     * @returns DAG DAG details
     * @throws ApiError
     */
    public getDag({
        id,
    }: {
        /**
         * The DAG ID
         */
        id: string,
    }): CancelablePromise<DAG> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/dags/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `Resource not found`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Update DAG
     * Update DAG properties (status, result, params)
     * @returns DAG DAG updated successfully
     * @throws ApiError
     */
    public updateDag({
        id,
        requestBody,
    }: {
        /**
         * The DAG ID
         */
        id: string,
        requestBody: UpdateDAGRequest,
    }): CancelablePromise<DAG> {
        return this.httpRequest.request({
            method: 'PATCH',
            url: '/api/v1/dags/{id}',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Bad Request - validation error`,
                404: `Resource not found`,
                500: `Internal server error`,
            },
        });
    }
    /**
     * Delete DAG
     * Delete a DAG (only if no executions exist)
     * @returns MessageResponse DAG deleted successfully
     * @throws ApiError
     */
    public deleteDag({
        id,
    }: {
        /**
         * The DAG ID
         */
        id: string,
    }): CancelablePromise<MessageResponse> {
        return this.httpRequest.request({
            method: 'DELETE',
            url: '/api/v1/dags/{id}',
            path: {
                'id': id,
            },
            errors: {
                404: `Resource not found`,
                409: `Conflict - DAG has existing executions`,
                500: `Internal server error`,
            },
        });
    }
}
