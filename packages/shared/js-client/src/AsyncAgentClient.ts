/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BaseHttpRequest } from './core/BaseHttpRequest';
import type { OpenAPIConfig } from './core/OpenAPI';
import { AxiosHttpRequest } from './core/AxiosHttpRequest';
import { GoalsService } from './services/GoalsService';
import { HealthService } from './services/HealthService';
import { RunsService } from './services/RunsService';
type HttpRequestConstructor = new (config: OpenAPIConfig) => BaseHttpRequest;
export class AsyncAgentClient {
    public readonly goals: GoalsService;
    public readonly health: HealthService;
    public readonly runs: RunsService;
    public readonly request: BaseHttpRequest;
    constructor(config?: Partial<OpenAPIConfig>, HttpRequest: HttpRequestConstructor = AxiosHttpRequest) {
        this.request = new HttpRequest({
            BASE: config?.BASE ?? 'http://localhost:3000/api/v1',
            VERSION: config?.VERSION ?? '0.1.0',
            WITH_CREDENTIALS: config?.WITH_CREDENTIALS ?? false,
            CREDENTIALS: config?.CREDENTIALS ?? 'include',
            TOKEN: config?.TOKEN,
            USERNAME: config?.USERNAME,
            PASSWORD: config?.PASSWORD,
            HEADERS: config?.HEADERS,
            ENCODE_PATH: config?.ENCODE_PATH,
        });
        this.goals = new GoalsService(this.request);
        this.health = new HealthService(this.request);
        this.runs = new RunsService(this.request);
    }
}

