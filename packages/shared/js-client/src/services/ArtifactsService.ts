/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise.js';
import type { BaseHttpRequest } from '../core/BaseHttpRequest.js';
export class ArtifactsService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Get artifact content
     * Retrieve the content of a generated artifact file
     * @returns string Artifact content
     * @throws ApiError
     */
    public getArtifact({
        filename,
    }: {
        /**
         * Name of the artifact file
         */
        filename: string,
    }): CancelablePromise<string> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/v1/artifacts/{filename}',
            path: {
                'filename': filename,
            },
            errors: {
                403: `Access denied`,
                404: `Resource not found`,
                500: `Internal server error`,
            },
        });
    }
}
