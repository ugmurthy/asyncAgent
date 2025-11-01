/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type Step = {
    /**
     * Unique step identifier
     */
    id: string;
    /**
     * Associated run ID
     */
    runId: string;
    /**
     * Step sequence number
     */
    stepNo: number;
    /**
     * Agent's reasoning for this step
     */
    thought: string;
    /**
     * Tool used in this step
     */
    toolName?: string | null;
    /**
     * Input parameters for the tool
     */
    toolInput?: Record<string, any> | null;
    /**
     * Result of tool execution
     */
    observation?: string | null;
    /**
     * Step execution time in milliseconds
     */
    durationMs: number;
    /**
     * Error message if step failed
     */
    error?: string | null;
    /**
     * ISO 8601 timestamp
     */
    createdAt: string;
};

