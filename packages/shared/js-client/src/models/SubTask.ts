/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type SubTask = {
    id: string;
    description: string;
    thought: string;
    action_type: 'tool' | 'inference';
    tool_or_prompt: {
        name: string;
        params?: Record<string, any>;
    };
    expected_output: string;
    dependencies: Array<string>;
};

