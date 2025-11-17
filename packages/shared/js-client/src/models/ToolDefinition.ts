/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ToolDefinition = {
    /**
     * Tool type
     */
    type: 'function';
    function: {
        /**
         * Tool function name
         */
        name: string;
        /**
         * Tool description
         */
        description: string;
        /**
         * JSON Schema for tool parameters
         */
        parameters?: Record<string, any>;
    };
};

