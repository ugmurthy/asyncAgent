/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type UpdateAgentRequest = {
    /**
     * Agent name
     */
    name?: string;
    /**
     * Agent version
     */
    version?: string;
    /**
     * Agent prompt template
     */
    promptTemplate?: string;
    /**
     * LLM provider for this agent
     */
    provider?: string;
    /**
     * LLM model for this agent
     */
    model?: string;
    /**
     * Additional agent metadata
     */
    metadata?: Record<string, any>;
};

