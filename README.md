# ClawTick CLI 🦞

> Cloud-powered cron scheduling for [OpenClaw](https://github.com/nicepkg/openclaw). Reliable triggers, real-time monitoring, zero missed jobs.

[![npm version](https://img.shields.io/npm/v/clawtick)](https://www.npmjs.com/package/clawtick)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Why ClawTick?

OpenClaw's built-in scheduler has known reliability issues — jobs silently fail, timers wedge, and `schedule.kind: 'every'` never fires. ClawTick replaces all of that with cloud infrastructure that works.

- Rock-solid cron scheduling
- Dashboard + CLI to manage everything
- Multi-channel delivery (WhatsApp, Telegram, Slack, Discord)
- Execution history and failure tracking
- Works with your existing OpenClaw gateway

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

```bash
clawtick job create \
  --cron "0 9 * * *" \
  --message "Good morning! Check my emails" \
  --name "Morning check"
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

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `--cron` | Yes | — | Cron expression (5-field) |
| `--message` | Yes | — | Message sent to the agent |
| `--name` | No | Auto | Job display name |
| `--agent` | No | `main` | Target agent ID |
| `--channel` | No | — | Delivery channel |
| `--deliver` | No | `false` | Send agent response to channel |
| `--reply-to` | No | — | Channel-specific target |
| `--timezone` | No | `UTC` | IANA timezone |

### Channels

| Channel | `--reply-to` value |
|---------|-------------------|
| `whatsapp` | Phone number (default chat) |
| `telegram` | Chat ID |
| `slack` | Channel name (`#general`) |
| `discord` | Channel ID |

## Examples

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
