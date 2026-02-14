/**
 * Clawtick Cloud API Client
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const CONFIG_DIR = join(homedir(), ".clawtick");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");
const DEFAULT_API_URL = "https://api.clawtick.com";

interface Config {
    apiUrl: string;
    apiKey: string;
}

function ensureConfigDir() {
    if (!existsSync(CONFIG_DIR)) {
        mkdirSync(CONFIG_DIR, { recursive: true });
    }
}

export function loadConfig(): Config {
    ensureConfigDir();
    if (!existsSync(CONFIG_FILE)) {
        return { apiUrl: DEFAULT_API_URL, apiKey: "" };
    }
    try {
        return JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
    } catch {
        return { apiUrl: DEFAULT_API_URL, apiKey: "" };
    }
}

export function saveConfig(config: Partial<Config>) {
    ensureConfigDir();
    const current = loadConfig();
    const merged = { ...current, ...config };
    writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2));
}

export function getConfigPath(): string {
    return CONFIG_FILE;
}

export class ApiClient {
    private apiUrl: string;
    private apiKey: string;

    constructor() {
        const config = loadConfig();
        this.apiUrl = config.apiUrl;
        this.apiKey = config.apiKey;
    }

    isAuthenticated(): boolean {
        return !!this.apiKey;
    }

    private async request(method: string, path: string, body?: any): Promise<any> {
        if (!this.apiKey) {
            throw new Error("Not authenticated. Run: clawtick login");
        }

        const res = await fetch(`${this.apiUrl}${path}`, {
            method,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.apiKey}`,
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
        });

        const data: any = await res.json().catch(() => ({}));

        if (!res.ok) {
            throw new Error(data.error || `API error: ${res.status}`);
        }

        return data;
    }

    // Jobs
    async listJobs() {
        return this.request("GET", "/v1/jobs");
    }

    async createJob(data: {
        name?: string;
        cron: string;
        message: string;
        integrationType?: string;
        // OpenClaw fields
        agent?: string;
        channel?: string;
        deliver?: boolean;
        replyTo?: string;
        // Webhook fields
        webhookUrl?: string;
        webhookMethod?: string;
        webhookHeaders?: Record<string, string>;
        webhookBody?: string;
        // Common fields
        timezone?: string;
    }) {
        return this.request("POST", "/v1/jobs", data);
    }

    async deleteJob(jobId: string) {
        return this.request("DELETE", `/v1/jobs/${jobId}`);
    }

    async updateJob(jobId: string, data: any) {
        return this.request("PUT", `/v1/jobs/${jobId}`, data);
    }

    async triggerJob(jobId: string) {
        return this.request("POST", `/v1/jobs/${jobId}/trigger`);
    }

    // Status
    async getStatus() {
        return this.request("GET", "/v1/status");
    }

    // Gateway
    async updateGateway(url: string, token: string) {
        return this.request("PUT", "/v1/gateway", { url, token });
    }
}
