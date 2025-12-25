/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type DAGExperimentsResponse = {
    status: 'completed';
    /**
     * Total number of experiments run
     */
    totalExperiments: number;
    /**
     * Number of successful DAG creations
     */
    successCount: number;
    /**
     * Number of failed DAG creations
     */
    failureCount: number;
    results: Array<{
        /**
         * The model used for this experiment
         */
        model: string;
        /**
         * The temperature used for this experiment
         */
        temperature: number;
        /**
         * The created DAG ID if successful
         */
        dagId?: string | null;
        /**
         * Whether the DAG creation was successful
         */
        success: boolean;
        /**
         * Error message if creation failed
         */
        error?: string;
    }>;
};

