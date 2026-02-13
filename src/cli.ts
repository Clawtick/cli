#!/usr/bin/env node

/**
 * Clawtick CLI — Cloud-powered scheduling for OpenClaw
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
} from "./validation.js";

const program = new Command();
const api = new ApiClient();

program
  .name("clawtick")
  .description("🦞 Cloud-powered scheduling for OpenClaw")
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
        console.log(`${status} ${chalk.bold(j.name)} ${chalk.gray(`(${j.id})`)}`);
        console.log(chalk.gray(`  Cron:    ${j.cron}`));
        console.log(chalk.gray(`  Message: ${j.message}`));
        console.log(chalk.gray(`  Agent:   ${j.agent || "main"}`));
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
  .option("--agent <id>", "Agent ID (default: main)")
  .option("--channel <channel>", "Target channel")
  .option("--deliver", "Deliver agent response", false)
  .option("--reply-to <target>", "Delivery target")
  .option("--timezone <tz>", "Timezone (default: UTC)")
  .action(async (options) => {
    // Validate first (no spinner needed for local validation)
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

    if (options.agent) {
      const agentCheck = validateAgentId(options.agent);
      if (!agentCheck.valid) {
        console.error(chalk.red(`❌ ${agentCheck.error}`));
        process.exit(1);
      }
    }

    const spinner = ora("Creating job...").start();
    try {
      const data = await api.createJob({
        name: options.name,
        cron: options.cron,
        message: options.message,
        agent: options.agent,
        channel: options.channel,
        deliver: options.deliver,
        replyTo: options.replyTo,
        timezone: options.timezone,
      });

      const j = data.job;
      spinner.succeed("Job created");
      console.log(chalk.gray(`ID:      ${j.id}`));
      console.log(chalk.gray(`Name:    ${j.name}`));
      console.log(chalk.gray(`Cron:    ${j.cron}`));
      console.log(chalk.gray(`Message: ${j.message}`));
      console.log(chalk.gray(`Agent:   ${j.agent}`));
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
  .option("--enable", "Enable the job")
  .option("--disable", "Disable the job")
  .action(async (jobId, options) => {
    const updates: any = {};
    if (options.name) updates.name = options.name;
    if (options.cron) updates.cron = options.cron;
    if (options.message) updates.message = options.message;
    if (options.enable) updates.enabled = true;
    if (options.disable) updates.enabled = false;

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
