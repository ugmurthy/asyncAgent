/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BaseHttpRequest } from './core/BaseHttpRequest.js';
import type { OpenAPIConfig } from './core/OpenAPI.js';
import { AxiosHttpRequest } from './core/AxiosHttpRequest.js';
import { AgentsService } from './services/AgentsService.js';
import { GoalsService } from './services/GoalsService.js';
import { HealthService } from './services/HealthService.js';
import { RunsService } from './services/RunsService.js';
type HttpRequestConstructor = new (config: OpenAPIConfig) => BaseHttpRequest;
export class AsyncAgentClient {
    public readonly agents: AgentsService;
    public readonly goals: GoalsService;
    public readonly health: HealthService;
    public readonly runs: RunsService;
    public readonly request: BaseHttpRequest;
    constructor(config?: Partial<OpenAPIConfig>, HttpRequest: HttpRequestConstructor = AxiosHttpRequest) {
        this.request = new HttpRequest({
            BASE: config?.BASE ?? 'http://localhost:3000/api/v1',
            VERSION: config?.VERSION ?? '0.2.0',
            WITH_CREDENTIALS: config?.WITH_CREDENTIALS ?? false,
            CREDENTIALS: config?.CREDENTIALS ?? 'include',
            TOKEN: config?.TOKEN,
            USERNAME: config?.USERNAME,
            PASSWORD: config?.PASSWORD,
            HEADERS: config?.HEADERS,
            ENCODE_PATH: config?.ENCODE_PATH,
        });
        this.agents = new AgentsService(this.request);
        this.goals = new GoalsService(this.request);
        this.health = new HealthService(this.request);
        this.runs = new RunsService(this.request);
    }
}

