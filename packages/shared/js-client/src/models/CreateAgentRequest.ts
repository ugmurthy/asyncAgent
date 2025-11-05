/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CreateAgentRequest = {
    /**
     * Agent name
     */
    name: string;
    /**
     * Agent version
     */
    version: string;
    /**
     * Agent prompt template
     */
    promptTemplate: string;
    /**
     * Additional agent metadata
     */
    metadata?: Record<string, any>;
};

