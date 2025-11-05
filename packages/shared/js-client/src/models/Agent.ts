/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type Agent = {
    /**
     * Unique agent identifier
     */
    id: string;
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
     * Whether this agent version is active
     */
    active: boolean;
    /**
     * Additional agent metadata
     */
    metadata: Record<string, any>;
    /**
     * ISO 8601 timestamp
     */
    createdAt: string;
    /**
     * ISO 8601 timestamp
     */
    updatedAt: string;
};

