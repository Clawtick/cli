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
  .description("🦞 Cloud scheduler for AI agents. Never miss a job again.")
  .version("2.0.0")
  .addHelpText('after', `
${chalk.bold('Categories:')}
  ${chalk.cyan('Account')}    login, logout, whoami, plan, usage
  ${chalk.cyan('Jobs')}       jobs list, jobs create, jobs inspect, jobs trigger
  ${chalk.cyan('Gateway')}    gateway set, gateway status, gateway test
  ${chalk.cyan('Keys')}       apikey list, apikey create, apikey revoke
  ${chalk.cyan('System')}     status, doctor, version

${chalk.bold('Examples:')}
  clawtick login --key cp_your_key_here
  clawtick jobs create --cron "0 9 * * *" --message "Daily report"
  clawtick jobs trigger <job-id> --sync
  clawtick usage

${chalk.bold('Documentation:')} ${chalk.cyan('https://clawtick.com/docs')}
  `);

// ══════════════════════════════════════════════════════
// ACCOUNT COMMANDS
// ══════════════════════════════════════════════════════

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

program
  .command("logout")
  .description("Remove stored credentials")
  .action(() => {
    saveConfig({ apiKey: "" });
    console.log(chalk.green("✅ Logged out"));
  });

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

program
  .command("plan")
  .description("Show current plan and limits")
  .action(async () => {
    const spinner = ora("Fetching plan details...").start();
    try {
      const s = await api.getStatus();
      spinner.succeed(`Current Plan: ${s.plan.toUpperCase()}\n`);

      console.log(chalk.bold("Limits:"));
      console.log(chalk.gray(`  Max Jobs:         ${s.jobs.limit === -1 ? 'Unlimited' : s.jobs.limit}`));
      console.log(chalk.gray(`  Monthly Triggers: ${s.runs.limit === -1 ? 'Unlimited' : s.runs.limit.toLocaleString()}`));
      console.log(chalk.gray(`  History Retention: ${s.historyDays} days`));

      console.log(chalk.bold("\nCurrent Usage:"));
      console.log(chalk.gray(`  Active Jobs:      ${s.jobs.enabled}/${s.jobs.total}`));
      console.log(chalk.gray(`  This Month:       ${s.runs.thisMonth?.toLocaleString() || 0} triggers`));

      if (s.priceGrandfathered) {
        console.log(chalk.yellow("\n⭐ Early Adopter - Grandfathered Pricing"));
      }

      console.log(chalk.gray("\nUpgrade at: https://clawtick.com/dashboard/billing"));
    } catch (err: any) {
      spinner.fail(err.message);
      process.exit(1);
    }
  });

program
  .command("usage")
  .description("Show monthly usage and quota")
  .action(async () => {
    const spinner = ora("Fetching usage data...").start();
    try {
      const s = await api.getStatus();
      spinner.succeed("Usage Report\n");

      const triggerLimit = s.quota.triggersMax === -1 ? Infinity : s.quota.triggersMax;
      const triggerUsage = s.quota.triggersUsed || 0;
      const triggerPercent = triggerLimit === Infinity ? 0 : Math.round((triggerUsage / triggerLimit) * 100);

      console.log(chalk.bold("Monthly Triggers:"));
      console.log(chalk.gray(`  Used:      ${triggerUsage.toLocaleString()}`));
      console.log(chalk.gray(`  Limit:     ${triggerLimit === Infinity ? 'Unlimited' : triggerLimit.toLocaleString()}`));
      if (triggerLimit !== Infinity) {
        const bar = "█".repeat(Math.floor(triggerPercent / 5)) + "░".repeat(20 - Math.floor(triggerPercent / 5));
        console.log(chalk.gray(`  Progress:  [${bar}] ${triggerPercent}%`));
      }

      console.log(chalk.bold("\nJobs:"));
      console.log(chalk.gray(`  Enabled:   ${s.jobs.enabled}`));
      console.log(chalk.gray(`  Total:     ${s.jobs.total}`));
      console.log(chalk.gray(`  Limit:     ${s.quota.jobsMax === -1 ? 'Unlimited' : s.quota.jobsMax}`));

      console.log(chalk.bold("\nLast 24 Hours:"));
      console.log(chalk.gray(`  Total Runs: ${s.last24h.total}`));
      console.log(chalk.gray(`  Failed:     ${s.last24h.failed}`));
      console.log(chalk.gray(`  Success:    ${s.last24h.total - s.last24h.failed}`));

    } catch (err: any) {
      spinner.fail(err.message);
      process.exit(1);
    }
  });

// ══════════════════════════════════════════════════════
// GATEWAY COMMANDS
// ══════════════════════════════════════════════════════

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

gateway
  .command("status")
  .description("Show current gateway configuration")
  .action(async () => {
    const spinner = ora("Fetching gateway config...").start();
    try {
      const config = await api.getGateway();
      if (!config.url) {
        spinner.info("No gateway configured");
        console.log(chalk.gray("\nConfigure your OpenClaw gateway:"));
        console.log(chalk.gray("  clawtick gateway set --url <url> --token <token>"));
        return;
      }
      spinner.succeed("Gateway Configuration\n");
      console.log(chalk.gray(`  URL:   ${config.url}`));
      console.log(chalk.gray(`  Token: ${config.token ? config.token.slice(0, 10) + '...' : 'Not set'}`));
    } catch (err: any) {
      spinner.fail(err.message);
      process.exit(1);
    }
  });

gateway
  .command("test")
  .description("Test gateway connectivity")
  .action(async () => {
    const spinner = ora("Testing gateway connection...").start();
    try {
      const result = await api.testGateway();
      if (result.success) {
        spinner.succeed(`Gateway connection successful (${result.latency}ms)`);
      } else {
        spinner.fail(`Gateway connection failed: ${result.message}`);
        process.exit(1);
      }
    } catch (err: any) {
      spinner.fail(err.message);
      process.exit(1);
    }
  });

// ══════════════════════════════════════════════════════
// JOBS COMMANDS
// ══════════════════════════════════════════════════════

const jobs = program.command("jobs").description("Manage scheduled jobs");

jobs
  .command("list")
  .description("List all scheduled jobs")
  .option("--enabled", "Show only enabled jobs")
  .option("--disabled", "Show only disabled jobs")
  .action(async (options) => {
    const spinner = ora("Fetching jobs...").start();
    try {
      const data = await api.listJobs();
      let jobsList = data.jobs || [];

      // Filter by enabled/disabled
      if (options.enabled) {
        jobsList = jobsList.filter((j: any) => j.enabled);
      } else if (options.disabled) {
        jobsList = jobsList.filter((j: any) => !j.enabled);
      }

      if (jobsList.length === 0) {
        spinner.info("No jobs found. Create one with: clawtick jobs create");
        return;
      }

      spinner.succeed(`${jobsList.length} job(s) found\n`);

      for (const j of jobsList) {
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

jobs
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

jobs
  .command("inspect <jobId>")
  .description("Show detailed information about a job")
  .action(async (jobId) => {
    const spinner = ora("Fetching job details...").start();
    try {
      const data = await api.listJobs();
      const job = data.jobs?.find((j: any) => j.id === jobId);

      if (!job) {
        spinner.fail(`Job not found: ${jobId}`);
        process.exit(1);
      }

      spinner.succeed(`Job: ${job.name}\n`);

      const status = job.enabled ? chalk.green("Enabled") : chalk.gray("Disabled");
      const integrationType = job.integrationType || "openclaw";

      console.log(chalk.bold("Details:"));
      console.log(chalk.gray(`  ID:          ${job.id}`));
      console.log(chalk.gray(`  Name:        ${job.name}`));
      console.log(chalk.gray(`  Status:      ${status}`));
      console.log(chalk.gray(`  Integration: ${integrationType}`));
      console.log(chalk.gray(`  Cron:        ${job.cron}`));
      console.log(chalk.gray(`  Message:     ${job.message}`));
      console.log(chalk.gray(`  Timezone:    ${job.timezone || 'UTC'}`));

      if (integrationType === "webhook") {
        console.log(chalk.bold("\nWebhook Configuration:"));
        console.log(chalk.gray(`  URL:     ${job.webhookUrl}`));
        console.log(chalk.gray(`  Method:  ${job.webhookMethod}`));
        if (job.webhookHeaders && Object.keys(job.webhookHeaders).length > 0) {
          console.log(chalk.gray(`  Headers: ${JSON.stringify(job.webhookHeaders, null, 2)}`));
        }
        if (job.webhookBody) {
          console.log(chalk.gray(`  Body:    ${job.webhookBody}`));
        }
      } else {
        console.log(chalk.bold("\nOpenClaw Configuration:"));
        console.log(chalk.gray(`  Agent:   ${job.agent || "main"}`));
        if (job.channel) {
          console.log(chalk.gray(`  Channel: ${job.channel}`));
        }
        if (job.deliver) {
          console.log(chalk.gray(`  Deliver: Yes → ${job.replyTo || 'Default'}`));
        }
      }

      console.log(chalk.bold("\nExecution Stats:"));
      console.log(chalk.gray(`  Total Runs:     ${job.runCount + job.failCount}`));
      console.log(chalk.gray(`  Successful:     ${job.runCount}`));
      console.log(chalk.gray(`  Failed:         ${job.failCount}`));
      if (job.lastRunAt) {
        console.log(chalk.gray(`  Last Run:       ${new Date(job.lastRunAt).toLocaleString()}`));
      }
      if (job.createdAt) {
        console.log(chalk.gray(`  Created:        ${new Date(job.createdAt).toLocaleString()}`));
      }

      if (job.source) {
        console.log(chalk.gray(`\n  Source:         ${job.source.toUpperCase()}`));
      }

    } catch (err: any) {
      spinner.fail(err.message);
      process.exit(1);
    }
  });

jobs
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

jobs
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

jobs
  .command("trigger <jobId>")
  .description("Manually trigger a job now")
  .option("--sync", "Wait for execution to complete and show results")
  .action(async (jobId, options) => {
    if (options.sync) {
      const spinner = ora("Triggering job and waiting for completion...").start();
      try {
        // Trigger the job
        await api.triggerJob(jobId);
        spinner.text = "Job triggered, waiting for execution...";

        // Poll for completion (check every 2 seconds, max 5 minutes)
        const maxAttempts = 150; // 5 minutes
        let attempts = 0;
        let completed = false;
        let result: any = null;

        while (attempts < maxAttempts && !completed) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          attempts++;

          // Fetch job runs
          const data = await api.listJobs();
          const job = data.jobs?.find((j: any) => j.id === jobId);

          if (job && job.lastRunAt) {
            const lastRunTime = new Date(job.lastRunAt).getTime();
            const now = Date.now();

            // If last run is within the last 30 seconds, assume it's our triggered run
            if (now - lastRunTime < 30000) {
              completed = true;
              result = {
                status: job.failCount > 0 ? 'failed' : 'success',
                lastRunAt: job.lastRunAt,
              };
            }
          }
        }

        if (completed && result) {
          if (result.status === 'success') {
            spinner.succeed(`Job completed successfully`);
            console.log(chalk.gray(`  Job ID:    ${jobId}`));
            console.log(chalk.gray(`  Completed: ${new Date(result.lastRunAt).toLocaleString()}`));
          } else {
            spinner.fail(`Job execution failed`);
            console.log(chalk.gray(`  Job ID:    ${jobId}`));
            console.log(chalk.gray(`  Failed at: ${new Date(result.lastRunAt).toLocaleString()}`));
            console.log(chalk.yellow("\nCheck logs for details:"));
            console.log(chalk.gray(`  clawtick jobs inspect ${jobId}`));
          }
        } else {
          spinner.warn(`Job triggered, but execution status unknown (timeout)`);
          console.log(chalk.gray(`  Job ID: ${jobId}`));
        }
      } catch (err: any) {
        spinner.fail(err.message);
        process.exit(1);
      }
    } else {
      // Async mode (original behavior)
      const spinner = ora("Triggering job...").start();
      try {
        await api.triggerJob(jobId);
        spinner.succeed(`Job triggered: ${jobId}`);
        console.log(chalk.gray("\nTip: Use --sync to wait for completion and see results"));
      } catch (err: any) {
        spinner.fail(err.message);
        process.exit(1);
      }
    }
  });

jobs
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

jobs
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

// ══════════════════════════════════════════════════════
// API KEY COMMANDS
// ══════════════════════════════════════════════════════

const apikey = program.command("apikey").description("Manage API keys");

apikey
  .command("list")
  .description("List all API keys")
  .action(async () => {
    const spinner = ora("Fetching API keys...").start();
    try {
      const data = await api.listApiKeys();
      const keys = data.keys || [];

      if (keys.length === 0) {
        spinner.info("No API keys found. Create one with: clawtick apikey create");
        return;
      }

      spinner.succeed(`${keys.length} API key(s) found\n`);

      for (const k of keys) {
        const prefix = k.key ? k.key.slice(0, 10) + '...' : k.keyId;
        console.log(chalk.bold(k.name || 'Unnamed'));
        console.log(chalk.gray(`  Key:     ${prefix}`));
        console.log(chalk.gray(`  ID:      ${k.keyId}`));
        if (k.createdAt) {
          console.log(chalk.gray(`  Created: ${new Date(k.createdAt).toLocaleString()}`));
        }
        if (k.lastUsed) {
          console.log(chalk.gray(`  Last:    ${new Date(k.lastUsed).toLocaleString()}`));
        }
        console.log();
      }
    } catch (err: any) {
      spinner.fail(err.message);
      process.exit(1);
    }
  });

apikey
  .command("create")
  .description("Create a new API key")
  .option("--name <name>", "Descriptive name for the key (e.g., ci-pipeline, production)")
  .action(async (options) => {
    const spinner = ora("Creating API key...").start();
    try {
      const data = await api.createApiKey(options.name);
      spinner.succeed("API key created\n");

      console.log(chalk.yellow("⚠️  Save this key securely - it won't be shown again!\n"));
      console.log(chalk.bold("API Key:"));
      console.log(chalk.cyan(`  ${data.key}\n`));
      console.log(chalk.gray(`Name: ${data.name || 'Unnamed'}`));
      console.log(chalk.gray(`ID:   ${data.keyId}`));

      console.log(chalk.gray("\nUse it with:"));
      console.log(chalk.gray(`  clawtick login --key ${data.key}`));
      console.log(chalk.gray(`  export CLAWPULSE_API_KEY=${data.key}`));
    } catch (err: any) {
      spinner.fail(err.message);
      process.exit(1);
    }
  });

apikey
  .command("revoke <keyId>")
  .description("Revoke an API key")
  .action(async (keyId) => {
    const spinner = ora("Revoking API key...").start();
    try {
      await api.revokeApiKey(keyId);
      spinner.succeed(`API key revoked: ${keyId}`);
      console.log(chalk.yellow("\n⚠️  This key can no longer be used for authentication"));
    } catch (err: any) {
      spinner.fail(err.message);
      process.exit(1);
    }
  });

// ══════════════════════════════════════════════════════
// SYSTEM COMMANDS
// ══════════════════════════════════════════════════════

program
  .command("doctor")
  .description("Run system diagnostics")
  .action(async () => {
    console.log(chalk.bold("🏥 Clawtick Health Check\n"));

    // Check authentication
    const config = loadConfig();
    if (!config.apiKey) {
      console.log(chalk.red("✗ Not authenticated"));
      console.log(chalk.gray("  Run: clawtick login --key <your-key>\n"));
      process.exit(1);
    }
    console.log(chalk.green("✓ API key found"));

    // Check API connection
    const spinner = ora("Checking API connection...").start();
    try {
      const status = await api.getStatus();
      spinner.succeed("API connection OK");
      console.log(chalk.gray(`  Plan: ${status.plan}`));
      console.log(chalk.gray(`  Jobs: ${status.jobs.enabled}/${status.jobs.total}\n`));
    } catch (err: any) {
      spinner.fail(`API connection failed: ${err.message}`);
      process.exit(1);
    }

    // Check gateway configuration (if OpenClaw is used)
    try {
      const gatewayConfig = await api.getGateway();
      if (gatewayConfig.url) {
        console.log(chalk.green("✓ Gateway configured"));
        console.log(chalk.gray(`  URL: ${gatewayConfig.url}\n`));

        // Test gateway connection
        const testSpinner = ora("Testing gateway connection...").start();
        try {
          const testResult = await api.testGateway();
          if (testResult.success) {
            testSpinner.succeed(`Gateway connection OK (${testResult.latency}ms)`);
          } else {
            testSpinner.fail(`Gateway connection failed: ${testResult.message}`);
          }
        } catch (err: any) {
          testSpinner.fail(`Gateway test failed: ${err.message}`);
        }
      } else {
        console.log(chalk.yellow("⚠ Gateway not configured"));
        console.log(chalk.gray("  Configure with: clawtick gateway set --url <url> --token <token>\n"));
      }
    } catch (err: any) {
      console.log(chalk.yellow(`⚠ Could not check gateway: ${err.message}\n`));
    }

    // Check for quota issues
    try {
      const status = await api.getStatus();
      const triggerLimit = status.quota.triggersMax;
      const triggerUsage = status.quota.triggersUsed || 0;

      if (triggerLimit !== -1) {
        const usage = (triggerUsage / triggerLimit) * 100;
        if (usage >= 90) {
          console.log(chalk.yellow(`⚠ High trigger usage: ${Math.round(usage)}%`));
          console.log(chalk.gray("  Consider upgrading your plan\n"));
        } else if (usage >= 100) {
          console.log(chalk.red("✗ Trigger quota exceeded"));
          console.log(chalk.gray("  Upgrade at: https://clawtick.com/dashboard/billing\n"));
        } else {
          console.log(chalk.green(`✓ Quota healthy (${Math.round(usage)}% used)\n`));
        }
      }
    } catch (err: any) {
      console.log(chalk.yellow(`⚠ Could not check quota: ${err.message}\n`));
    }

    console.log(chalk.green("All checks completed!"));
  });

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
