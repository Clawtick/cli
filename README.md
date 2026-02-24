# ClawTick CLI 🦞

> Scheduling infrastructure for AI agents. CLI-first API with monitoring, retries, and alerts. Let agents schedule tasks with minimal tokens.

[![npm version](https://img.shields.io/npm/v/clawtick)](https://www.npmjs.com/package/clawtick)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Why ClawTick?

AI agents need infrastructure, not tutorials. ClawTick provides programmatic scheduling without the complexity:

- **CLI-First Design**: One command, minimal tokens. No context rot from complex setups
- **Agent-Friendly API**: Create jobs, check status, query logs — all programmatically
- **Zero Infrastructure**: No servers to manage. Just call the API and it works
- **Built-in Monitoring**: Email alerts on failures. Full execution history for debugging
- **Works with Any Stack**: Webhooks, HTTP APIs, OpenClaw agents, LangChain flows
- **99.9% Uptime**: AWS EventBridge-powered reliability

## Install

```bash
npm install -g clawtick
```

## Quick Start

### 1. Login

Get your API key from [clawtick.com/dashboard/api-keys](https://clawtick.com/dashboard/api-keys):

```bash
clawtick login --key cp_your_api_key
```

### 2. Schedule your first job

**Schedule a webhook:**

```bash
clawtick jobs create \
  --integration webhook \
  --cron "0 9 * * *" \
  --message "Daily report trigger" \
  --webhook-url "https://api.example.com/trigger" \
  --webhook-method POST \
  --name "Daily webhook"
```

**Schedule an OpenClaw agent:**

First, configure your gateway:
```bash
clawtick gateway set --url http://your-vps:80 --token your_gateway_token
```

Then create the job:
```bash
clawtick jobs create \
  --cron "0 9 * * *" \
  --message "Good morning! Check my emails" \
  --name "Morning check"
```

That's it. Your job runs reliably at 9 AM UTC every day.

## Commands

### Account

```bash
clawtick login --key <api-key>     # Authenticate with API key
clawtick logout                     # Remove stored credentials
clawtick whoami                     # Show authentication status
clawtick plan                       # Show current plan and limits
clawtick usage                      # Show monthly usage and quota
```

### Jobs

```bash
clawtick jobs list                  # List all scheduled jobs
clawtick jobs list --enabled        # Show only enabled jobs
clawtick jobs create [options]      # Create a new job
clawtick jobs inspect <id>          # Show detailed job information
clawtick jobs update <id> [options] # Update a job
clawtick jobs remove <id>           # Delete a job
clawtick jobs trigger <id>          # Run a job now (async)
clawtick jobs trigger <id> --sync   # Run a job and wait for completion
clawtick jobs enable <id>           # Resume a paused job
clawtick jobs disable <id>          # Pause a job
```

### Gateway (OpenClaw)

```bash
clawtick gateway set --url <url> --token <token>  # Configure gateway
clawtick gateway status                            # Show current config
clawtick gateway test                              # Test connectivity
```

### API Keys

```bash
clawtick apikey list                # List all API keys
clawtick apikey create --name <name> # Create a new API key
clawtick apikey revoke <key-id>      # Revoke an API key
```

### System

```bash
clawtick status                     # Show account status and stats
clawtick doctor                     # Run system diagnostics
clawtick version                    # Show CLI version
```

## Job Options

### Common Options

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `--cron` | Yes | — | Cron expression (5-field) |
| `--message` | Yes | — | Message/payload content |
| `--name` | No | Auto | Job display name |
| `--integration` | No | `openclaw` | Integration type: `openclaw` or `webhook` |
| `--timezone` | No | `UTC` | IANA timezone |

### OpenClaw Options

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `--agent` | No | `main` | Target agent ID |
| `--channel` | No | — | Delivery channel |
| `--deliver` | No | `false` | Send agent response to channel |
| `--reply-to` | No | — | Channel-specific target |

### Webhook Options

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `--webhook-url` | Yes* | — | HTTP/HTTPS endpoint URL |
| `--webhook-method` | Yes* | — | HTTP method: GET, POST, PUT, DELETE |
| `--webhook-headers` | No | — | JSON object of headers |
| `--webhook-body` | No | Auto | Custom body template (supports `{{variables}}`) |

*Required when `--integration webhook` is used

### Channels

| Channel | `--reply-to` value |
|---------|-------------------|
| `whatsapp` | Phone number (default chat) |
| `telegram` | Chat ID |
| `slack` | Channel name (`#general`) |
| `discord` | Channel ID |

## Examples

### Webhook Integration (Most Common)

```bash
# Trigger LangChain agent daily
clawtick jobs create \
  --integration webhook \
  --cron "0 8 * * *" \
  --message "Generate daily insights" \
  --webhook-url "https://api.example.com/langchain/trigger" \
  --webhook-method POST \
  --webhook-headers '{"Authorization": "Bearer sk-xxx"}' \
  --name "langchain-daily"

# Trigger CrewAI workflow hourly
clawtick jobs create \
  --integration webhook \
  --cron "0 * * * *" \
  --message "Run content generation crew" \
  --webhook-url "https://api.example.com/crew/run" \
  --webhook-method POST \
  --webhook-body '{"task": "{{message}}", "timestamp": "{{timestamp}}"}' \
  --name "crewai-hourly"

# Simple GET webhook every 15 minutes
clawtick jobs create \
  --integration webhook \
  --cron "*/15 * * * *" \
  --message "Health check" \
  --webhook-url "https://api.example.com/health?job={{jobId}}" \
  --webhook-method GET \
  --name "health-check"

# Custom agent with authentication
clawtick jobs create \
  --integration webhook \
  --cron "0 12 * * *" \
  --message "Noon report" \
  --webhook-url "https://your-agent.com/api/trigger" \
  --webhook-method POST \
  --webhook-headers '{"X-Api-Key": "your-key", "Content-Type": "application/json"}' \
  --webhook-body '{"prompt": "{{message}}", "job_name": "{{jobName}}"}' \
  --name "custom-agent"

# Test a webhook immediately with --sync
clawtick jobs trigger job-123 --sync  # Wait for completion and see results
```

### OpenClaw Integration (AI Agents)

```bash
# Daily morning briefing to WhatsApp
clawtick jobs create \
  --cron "0 9 * * *" \
  --message "Summarize my calendar and top emails" \
  --name "morning-briefing" \
  --agent main \
  --channel whatsapp \
  --deliver

# Hourly status check to Telegram
clawtick jobs create \
  --cron "0 * * * *" \
  --message "System status check" \
  --name "status-check" \
  --channel telegram \
  --deliver \
  --reply-to 123456789

# Weekly report every Monday
clawtick jobs create \
  --cron "0 10 * * 1" \
  --message "Generate weekly activity report" \
  --name "weekly-report" \
  --channel slack \
  --deliver \
  --reply-to "#reports"

# Health check every 5 minutes (logs only, no delivery)
clawtick jobs create \
  --cron "*/5 * * * *" \
  --message "Health check ping" \
  --name "health-check"
```

### Agent Workflows

```bash
# Check if everything is working
clawtick doctor

# Monitor your usage and quota
clawtick usage

# Inspect a job's configuration and execution history
clawtick jobs inspect job-123

# List only enabled jobs
clawtick jobs list --enabled

# Create and test a job immediately
clawtick jobs create --cron "0 9 * * *" --message "Test" --integration webhook \
  --webhook-url "https://webhook.site/xxx" --webhook-method POST --name "test-job"

# Trigger it synchronously to verify it works
clawtick jobs trigger test-job --sync
```

### Template Variables

Webhook URLs and bodies support template variables:

- `{{message}}` - Job message content
- `{{jobId}}` - Unique job identifier
- `{{jobName}}` - Job display name
- `{{runId}}` - Unique execution identifier
- `{{timestamp}}` - ISO 8601 timestamp of execution

Example:
```bash
--webhook-body '{"prompt": "{{message}}", "meta": {"job": "{{jobName}}", "time": "{{timestamp}}"}}'
```

## Plans

| | Free | Starter ($29/mo) | Pro ($79/mo) |
|---|---|---|---|
| Jobs | 10 | 100 | Unlimited |
| Triggers/month | 1,000 | 10,000 | 100,000 |
| History | 7 days | 30 days | 90 days |

Sign up at [clawtick.com](https://clawtick.com) — free plan, no credit card.

## Configuration

Config is stored in `~/.clawtick/config.json`. You can also use environment variables:

```bash
export CLAWPULSE_API_KEY=cp_your_key    # Skip login
```

## Links

- [Dashboard](https://clawtick.com/dashboard)
- [Documentation](https://clawtick.com/docs)
- [Issues](https://github.com/clawtick/cli/issues)

## License

MIT — see [LICENSE](./LICENSE)
