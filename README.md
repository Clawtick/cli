# ClawTick CLI 🦞

> Cloud-powered job scheduling for AI agents. Supports [OpenClaw](https://github.com/nicepkg/openclaw), LangChain, CrewAI, custom webhooks, and more. Reliable triggers, real-time monitoring, zero missed jobs.

[![npm version](https://img.shields.io/npm/v/clawtick)](https://www.npmjs.com/package/clawtick)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Why ClawTick?

Schedule any AI agent, any framework. ClawTick provides rock-solid cloud infrastructure for cron scheduling with:

- **Multi-framework support**: OpenClaw, LangChain, CrewAI, custom webhooks
- **Rock-solid cron scheduling**: AWS EventBridge-powered reliability
- **Dashboard + CLI**: Manage everything from web or terminal
- **OpenClaw features**: Multi-channel delivery (WhatsApp, Telegram, Slack, Discord)
- **Webhook integration**: Trigger any HTTP endpoint on schedule
- **Execution history**: Track success rates and debug failures
- **Template variables**: Dynamic URLs and payloads with `{{message}}`, `{{timestamp}}`, etc.

## Install

```bash
npm install -g clawtick
```

## Quick Start

### 1. Get an API key

Sign up at [clawtick.com](https://clawtick.com) and generate a key from **Dashboard → API Keys**.

### 2. Login

```bash
clawtick login --key cp_your_api_key
```

### 3. Configure your gateway

```bash
clawtick gateway set --url http://your-vps:80 --token your_gateway_token
```

### 4. Create your first job

**For OpenClaw:**

```bash
clawtick job create \
  --cron "0 9 * * *" \
  --message "Good morning! Check my emails" \
  --name "Morning check"
```

**For Webhook (any HTTP endpoint):**

```bash
clawtick job create \
  --integration webhook \
  --cron "0 9 * * *" \
  --message "Daily report trigger" \
  --webhook-url "https://api.example.com/trigger" \
  --webhook-method POST \
  --name "Daily webhook"
```

That's it. The job will fire daily at 9 AM UTC.

## Commands

### Authentication

```bash
clawtick login --key <api-key>    # Authenticate
clawtick logout                    # Remove credentials
clawtick whoami                    # Check connection status
```

### Jobs

```bash
clawtick job list                  # List all jobs
clawtick job create [options]      # Create a new job
clawtick job update <id> [options] # Update a job
clawtick job remove <id>           # Delete a job
clawtick job trigger <id>          # Run a job now
clawtick job enable <id>           # Resume a paused job
clawtick job disable <id>          # Pause a job
```

### Gateway

```bash
clawtick gateway set --url <url> --token <token>
```

### Account

```bash
clawtick status                    # View plan, usage, stats
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

### OpenClaw Integration

```bash
# Daily morning briefing to WhatsApp
clawtick job create \
  --cron "0 9 * * *" \
  --message "Summarize my calendar and top emails" \
  --name "morning-briefing" \
  --agent main \
  --channel whatsapp \
  --deliver

# Hourly status check to Telegram
clawtick job create \
  --cron "0 * * * *" \
  --message "System status check" \
  --name "status-check" \
  --channel telegram \
  --deliver \
  --reply-to 123456789

# Weekly report every Monday
clawtick job create \
  --cron "0 10 * * 1" \
  --message "Generate weekly activity report" \
  --name "weekly-report" \
  --channel slack \
  --deliver \
  --reply-to "#reports"

# Health check every 5 minutes (logs only, no delivery)
clawtick job create \
  --cron "*/5 * * * *" \
  --message "Health check ping" \
  --name "health-check"
```

### Webhook Integration

```bash
# Trigger LangChain agent daily
clawtick job create \
  --integration webhook \
  --cron "0 8 * * *" \
  --message "Generate daily insights" \
  --webhook-url "https://api.example.com/langchain/trigger" \
  --webhook-method POST \
  --webhook-headers '{"Authorization": "Bearer sk-xxx"}' \
  --name "langchain-daily"

# Trigger CrewAI workflow hourly
clawtick job create \
  --integration webhook \
  --cron "0 * * * *" \
  --message "Run content generation crew" \
  --webhook-url "https://api.example.com/crew/run" \
  --webhook-method POST \
  --webhook-body '{"task": "{{message}}", "timestamp": "{{timestamp}}"}' \
  --name "crewai-hourly"

# Simple GET webhook every 15 minutes
clawtick job create \
  --integration webhook \
  --cron "*/15 * * * *" \
  --message "Health check" \
  --webhook-url "https://api.example.com/health?job={{jobId}}" \
  --webhook-method GET \
  --name "health-check"

# Custom agent with authentication
clawtick job create \
  --integration webhook \
  --cron "0 12 * * *" \
  --message "Noon report" \
  --webhook-url "https://your-agent.com/api/trigger" \
  --webhook-method POST \
  --webhook-headers '{"X-Api-Key": "your-key", "Content-Type": "application/json"}' \
  --webhook-body '{"prompt": "{{message}}", "job_name": "{{jobName}}"}' \
  --name "custom-agent"
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

| | Free | Starter ($9/mo) | Pro ($29/mo) |
|---|---|---|---|
| Jobs | 10 | 50 | Unlimited |
| Triggers/month | 500 | 5,000 | 50,000 |
| History | 14 days | 30 days | 90 days |

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
