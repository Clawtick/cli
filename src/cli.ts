#!/usr/bin/env node

/**
 * Clawtick CLI — Cloud-powered job scheduling for AI agents
 */

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { ApiClient, saveConfig, loadConfig, getConfigPath } from "./api-client.js";
import {
  validateCronExpression,
  validateJobName,
  validateMessage,
  validateAgentId,
  validateIntegrationType,
  validateWebhookUrl,
  validateWebhookMethod,
  validateWebhookHeaders,
  validateWebhookBody,
} from "./validation.js";

const program = new Command();
const api = new ApiClient();

program
  .name("clawtick")
  .description("🦞 Cloud-powered job scheduling for AI agents (OpenClaw, webhooks, and more)")
  .version("2.0.0");

// ── Login ──────────────────────────────────────────────

program
  .command("login")
  .description("Authenticate with your Clawtick API key")
  .option("--key <apiKey>", "API key (or set CLAWPULSE_API_KEY env var)")
  .option("--api-url <url>", "API URL (for self-hosted)")
  .action(async (options) => {
    const apiKey = options.key || process.env.CLAWPULSE_API_KEY;

    if (!apiKey) {
      console.log(chalk.blue("🦞 Clawtick Login\n"));
      console.log("Get your API key from the Clawtick dashboard:");
      console.log(chalk.cyan("  https://clawtick.com/dashboard/api-keys\n"));
      console.log("Then run:");
      console.log(chalk.gray("  clawtick login --key cp_your_api_key_here"));
      console.log(chalk.gray("\nOr set the environment variable:"));
      console.log(chalk.gray("  export CLAWPULSE_API_KEY=cp_your_api_key_here"));
      return;
    }

    const spinner = ora("Authenticating...").start();
    const config: any = { apiKey };
    if (options.apiUrl) config.apiUrl = options.apiUrl;
    saveConfig(config);
    spinner.succeed("Authenticated successfully");
    console.log(chalk.gray(`Config saved to ${getConfigPath()}`));
  });

// ── Logout ─────────────────────────────────────────────

program
  .command("logout")
  .description("Remove stored credentials")
  .action(() => {
    saveConfig({ apiKey: "" });
    console.log(chalk.green("✅ Logged out"));
  });

// ── Whoami ─────────────────────────────────────────────

program
  .command("whoami")
  .description("Show current authentication status")
  .action(async () => {
    const config = loadConfig();
    if (!config.apiKey) {
      console.log(chalk.yellow("Not authenticated. Run: clawtick login"));
      return;
    }
    console.log(chalk.gray(`API URL: ${config.apiUrl}`));
    console.log(chalk.gray(`API Key: ${config.apiKey.slice(0, 10)}...`));

    const spinner = ora("Checking connection...").start();
    try {
      const status = await api.getStatus();
      spinner.succeed(`Connected — Plan: ${status.plan}`);
      console.log(chalk.gray(`Jobs: ${status.jobs.enabled}/${status.jobs.total}`));
    } catch (err: any) {
      spinner.fail(`API error: ${err.message}`);
      process.exit(1);
    }
  });

// ── Gateway ────────────────────────────────────────────

const gateway = program.command("gateway").description("Manage OpenClaw gateway connection");

gateway
  .command("set")
  .description("Configure your OpenClaw gateway")
  .requiredOption("--url <url>", "Gateway URL (e.g., https://your-vps.com)")
  .requiredOption("--token <token>", "Gateway authentication token")
  .action(async (options) => {
    const spinner = ora("Configuring gateway...").start();
    try {
      await api.updateGateway(options.url, options.token);
      spinner.succeed("Gateway configured");
      console.log(chalk.gray(`URL: ${options.url}`));
    } catch (err: any) {
      spinner.fail(err.message);
      process.exit(1);
    }
  });

// ── Jobs ───────────────────────────────────────────────

const job = program.command("job").description("Manage scheduled jobs");

job
  .command("list")
  .description("List all scheduled jobs")
  .action(async () => {
    const spinner = ora("Fetching jobs...").start();
    try {
      const data = await api.listJobs();
      const jobs = data.jobs || [];

      if (jobs.length === 0) {
        spinner.info("No jobs found. Create one with: clawtick job create");
        return;
      }

      spinner.succeed(`${jobs.length} job(s) found\n`);

      for (const j of jobs) {
        const status = j.enabled ? chalk.green("●") : chalk.gray("○");
        const integrationType = j.integrationType || "openclaw";
        const integrationBadge = integrationType === "webhook"
          ? chalk.blue("🌐 webhook")
          : chalk.magenta("⚡ openclaw");
        const sourceBadge = j.source
          ? chalk.gray(`[${j.source.toUpperCase()}]`)
          : "";

        console.log(`${status} ${chalk.bold(j.name)} ${chalk.gray(`(${j.id})`)} ${integrationBadge} ${sourceBadge}`);
        console.log(chalk.gray(`  Cron:    ${j.cron}`));
        console.log(chalk.gray(`  Message: ${j.message}`));

        if (integrationType === "webhook") {
          console.log(chalk.gray(`  URL:     ${j.webhookUrl}`));
          console.log(chalk.gray(`  Method:  ${j.webhookMethod}`));
        } else {
          console.log(chalk.gray(`  Agent:   ${j.agent || "main"}`));
          if (j.channel) {
            console.log(chalk.gray(`  Channel: ${j.channel}`));
          }
        }

        console.log(chalk.gray(`  Runs:    ${j.runCount} success, ${j.failCount} failed`));
        if (j.lastRunAt) {
          console.log(chalk.gray(`  Last:    ${new Date(j.lastRunAt).toLocaleString()}`));
        }
        console.log();
      }
    } catch (err: any) {
      spinner.fail(err.message);
      process.exit(1);
    }
  });

job
  .command("create")
  .description("Create a new scheduled job")
  .requiredOption("--cron <expression>", 'Cron expression (e.g., "0 9 * * *")')
  .requiredOption("--message <text>", "Message to send to the agent")
  .option("--name <name>", "Job name")
  .option("--integration <type>", "Integration type: openclaw or webhook (default: openclaw)")
  .option("--agent <id>", "Agent ID (OpenClaw only, default: main)")
  .option("--channel <channel>", "Target channel (OpenClaw only)")
  .option("--deliver", "Deliver agent response (OpenClaw only)", false)
  .option("--reply-to <target>", "Delivery target (OpenClaw only)")
  .option("--webhook-url <url>", "Webhook URL (webhook integration only)")
  .option("--webhook-method <method>", "HTTP method: GET, POST, PUT, DELETE (webhook only)")
  .option("--webhook-headers <json>", "HTTP headers as JSON string (webhook only)")
  .option("--webhook-body <template>", "Request body template with {{variables}} (webhook only)")
  .option("--timezone <tz>", "Timezone (default: UTC)")
  .action(async (options) => {
    // Determine integration type (default: openclaw)
    const integrationType = options.integration?.toLowerCase() || "openclaw";

    // Validate integration type
    if (options.integration) {
      const typeCheck = validateIntegrationType(options.integration);
      if (!typeCheck.valid) {
        console.error(chalk.red(`❌ ${typeCheck.error}`));
        process.exit(1);
      }
    }

    // Validate common fields
    const cronCheck = validateCronExpression(options.cron);
    if (!cronCheck.valid) {
      console.error(chalk.red(`❌ ${cronCheck.error}`));
      process.exit(1);
    }

    const msgCheck = validateMessage(options.message);
    if (!msgCheck.valid) {
      console.error(chalk.red(`❌ ${msgCheck.error}`));
      process.exit(1);
    }

    if (options.name) {
      const nameCheck = validateJobName(options.name);
      if (!nameCheck.valid) {
        console.error(chalk.red(`❌ ${nameCheck.error}`));
        process.exit(1);
      }
    }

    // Validate based on integration type
    if (integrationType === "webhook") {
      // Webhook validation
      if (!options.webhookUrl) {
        console.error(chalk.red("❌ --webhook-url is required for webhook integration"));
        process.exit(1);
      }

      if (!options.webhookMethod) {
        console.error(chalk.red("❌ --webhook-method is required for webhook integration"));
        process.exit(1);
      }

      const urlCheck = validateWebhookUrl(options.webhookUrl);
      if (!urlCheck.valid) {
        console.error(chalk.red(`❌ ${urlCheck.error}`));
        process.exit(1);
      }

      const methodCheck = validateWebhookMethod(options.webhookMethod);
      if (!methodCheck.valid) {
        console.error(chalk.red(`❌ ${methodCheck.error}`));
        process.exit(1);
      }

      if (options.webhookHeaders) {
        const headersCheck = validateWebhookHeaders(options.webhookHeaders);
        if (!headersCheck.valid) {
          console.error(chalk.red(`❌ ${headersCheck.error}`));
          process.exit(1);
        }
      }

      if (options.webhookBody) {
        const bodyCheck = validateWebhookBody(options.webhookBody);
        if (!bodyCheck.valid) {
          console.error(chalk.red(`❌ ${bodyCheck.error}`));
          process.exit(1);
        }
      }
    } else {
      // OpenClaw validation
      if (options.agent) {
        const agentCheck = validateAgentId(options.agent);
        if (!agentCheck.valid) {
          console.error(chalk.red(`❌ ${agentCheck.error}`));
          process.exit(1);
        }
      }
    }

    const spinner = ora("Creating job...").start();
    try {
      const jobData: any = {
        name: options.name,
        cron: options.cron,
        message: options.message,
        integrationType,
        source: "cli", // Track that this job was created via CLI
        timezone: options.timezone,
      };

      // Add integration-specific fields
      if (integrationType === "webhook") {
        jobData.webhookUrl = options.webhookUrl;
        jobData.webhookMethod = options.webhookMethod.toUpperCase();
        if (options.webhookHeaders) {
          jobData.webhookHeaders = JSON.parse(options.webhookHeaders);
        }
        if (options.webhookBody) {
          jobData.webhookBody = options.webhookBody;
        }
      } else {
        jobData.agent = options.agent;
        jobData.channel = options.channel;
        jobData.deliver = options.deliver;
        jobData.replyTo = options.replyTo;
      }

      const data = await api.createJob(jobData);
      const j = data.job;

      spinner.succeed("Job created");
      console.log(chalk.gray(`ID:           ${j.id}`));
      console.log(chalk.gray(`Name:         ${j.name}`));
      console.log(chalk.gray(`Integration:  ${j.integrationType || "openclaw"}`));
      console.log(chalk.gray(`Cron:         ${j.cron}`));
      console.log(chalk.gray(`Message:      ${j.message}`));

      if (integrationType === "webhook") {
        console.log(chalk.gray(`Webhook URL:  ${j.webhookUrl}`));
        console.log(chalk.gray(`Method:       ${j.webhookMethod}`));
      } else {
        console.log(chalk.gray(`Agent:        ${j.agent || "main"}`));
      }
    } catch (err: any) {
      spinner.fail(err.message);
      process.exit(1);
    }
  });

job
  .command("remove <jobId>")
  .description("Delete a scheduled job")
  .action(async (jobId) => {
    const spinner = ora("Deleting job...").start();
    try {
      await api.deleteJob(jobId);
      spinner.succeed(`Job deleted: ${jobId}`);
    } catch (err: any) {
      spinner.fail(err.message);
      process.exit(1);
    }
  });

job
  .command("update <jobId>")
  .description("Update a job")
  .option("--name <name>", "New name")
  .option("--cron <expression>", "New cron expression")
  .option("--message <text>", "New message")
  .option("--integration <type>", "Integration type: openclaw or webhook")
  .option("--agent <id>", "Agent ID (OpenClaw only)")
  .option("--channel <channel>", "Target channel (OpenClaw only)")
  .option("--deliver", "Enable delivery (OpenClaw only)")
  .option("--no-deliver", "Disable delivery (OpenClaw only)")
  .option("--reply-to <target>", "Delivery target (OpenClaw only)")
  .option("--webhook-url <url>", "Webhook URL (webhook integration only)")
  .option("--webhook-method <method>", "HTTP method (webhook only)")
  .option("--webhook-headers <json>", "HTTP headers as JSON (webhook only)")
  .option("--webhook-body <template>", "Request body template (webhook only)")
  .option("--timezone <tz>", "Timezone")
  .option("--enable", "Enable the job")
  .option("--disable", "Disable the job")
  .action(async (jobId, options) => {
    const updates: any = {};

    // Common fields
    if (options.name) updates.name = options.name;
    if (options.cron) {
      const cronCheck = validateCronExpression(options.cron);
      if (!cronCheck.valid) {
        console.error(chalk.red(`❌ ${cronCheck.error}`));
        process.exit(1);
      }
      updates.cron = options.cron;
    }
    if (options.message) {
      const msgCheck = validateMessage(options.message);
      if (!msgCheck.valid) {
        console.error(chalk.red(`❌ ${msgCheck.error}`));
        process.exit(1);
      }
      updates.message = options.message;
    }
    if (options.timezone) updates.timezone = options.timezone;
    if (options.enable) updates.enabled = true;
    if (options.disable) updates.enabled = false;

    // Integration type
    if (options.integration) {
      const typeCheck = validateIntegrationType(options.integration);
      if (!typeCheck.valid) {
        console.error(chalk.red(`❌ ${typeCheck.error}`));
        process.exit(1);
      }
      updates.integrationType = options.integration.toLowerCase();
    }

    // OpenClaw fields
    if (options.agent !== undefined) updates.agent = options.agent;
    if (options.channel !== undefined) updates.channel = options.channel;
    if (options.deliver !== undefined) updates.deliver = options.deliver;
    if (options.replyTo !== undefined) updates.replyTo = options.replyTo;

    // Webhook fields
    if (options.webhookUrl) {
      const urlCheck = validateWebhookUrl(options.webhookUrl);
      if (!urlCheck.valid) {
        console.error(chalk.red(`❌ ${urlCheck.error}`));
        process.exit(1);
      }
      updates.webhookUrl = options.webhookUrl;
    }
    if (options.webhookMethod) {
      const methodCheck = validateWebhookMethod(options.webhookMethod);
      if (!methodCheck.valid) {
        console.error(chalk.red(`❌ ${methodCheck.error}`));
        process.exit(1);
      }
      updates.webhookMethod = options.webhookMethod.toUpperCase();
    }
    if (options.webhookHeaders) {
      const headersCheck = validateWebhookHeaders(options.webhookHeaders);
      if (!headersCheck.valid) {
        console.error(chalk.red(`❌ ${headersCheck.error}`));
        process.exit(1);
      }
      updates.webhookHeaders = JSON.parse(options.webhookHeaders);
    }
    if (options.webhookBody !== undefined) updates.webhookBody = options.webhookBody;

    if (Object.keys(updates).length === 0) {
      console.error(chalk.yellow("No updates provided. Use --help for options."));
      return;
    }

    const spinner = ora("Updating job...").start();
    try {
      await api.updateJob(jobId, updates);
      spinner.succeed(`Job updated: ${jobId}`);
    } catch (err: any) {
      spinner.fail(err.message);
      process.exit(1);
    }
  });

job
  .command("trigger <jobId>")
  .description("Manually trigger a job now")
  .action(async (jobId) => {
    const spinner = ora("Triggering job...").start();
    try {
      await api.triggerJob(jobId);
      spinner.succeed(`Job triggered: ${jobId}`);
    } catch (err: any) {
      spinner.fail(err.message);
      process.exit(1);
    }
  });

job
  .command("enable <jobId>")
  .description("Enable (resume) a paused job")
  .action(async (jobId) => {
    const spinner = ora("Enabling job...").start();
    try {
      await api.updateJob(jobId, { enabled: true });
      spinner.succeed(`Job enabled: ${jobId}`);
    } catch (err: any) {
      spinner.fail(err.message);
      process.exit(1);
    }
  });

job
  .command("disable <jobId>")
  .description("Disable (pause) a job")
  .action(async (jobId) => {
    const spinner = ora("Disabling job...").start();
    try {
      await api.updateJob(jobId, { enabled: false });
      spinner.succeed(`Job disabled: ${jobId}`);
    } catch (err: any) {
      spinner.fail(err.message);
      process.exit(1);
    }
  });

// ── Status ─────────────────────────────────────────────

program
  .command("status")
  .description("Show account status and stats")
  .action(async () => {
    const spinner = ora("Fetching status...").start();
    try {
      const s = await api.getStatus();
      spinner.succeed("Status loaded\n");
      console.log(chalk.gray(`Plan:         ${s.plan}`));
      console.log(chalk.gray(`Jobs:         ${s.jobs.enabled} enabled / ${s.jobs.total} total`));
      console.log(chalk.gray(`Total runs:   ${s.runs.total}`));
      console.log(chalk.gray(`Success rate: ${s.runs.successRate}%`));
      console.log(chalk.gray(`Last 24h:     ${s.last24h.total} runs (${s.last24h.failed} failed)`));
      console.log();
    } catch (err: any) {
      spinner.fail(err.message);
      process.exit(1);
    }
  });

program.parse();
