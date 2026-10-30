# Local provider usage and cost estimates

Foliquo records one row for each provider model request made by a translation, source extraction, revision, learning analysis, source-location lookup or field refinement. Rows live in the encrypted local workspace and are included in encrypted workspace backups. Provider API keys remain excluded from backups. The record contains provider/model identifiers, operation, local job ID, timestamps, provider-reported token counts, a bounded request/response status, and an optional USD estimate. It never stores prompts, source text, translated text or API credentials in the usage ledger.

The usage view reports the last 30 days and groups daily totals using the computer's local time zone. It only counts data Foliquo receives from the provider. Missing usage is marked partial or unknown rather than treated as zero. The local ledger retains at most 365 days and 5,000 request records. The summary is not the provider's complete account bill: it excludes usage from other apps, negotiated discounts, taxes, credits, and any billing dimensions the API does not report.

ChatGPT account sign-in does not provide Foliquo with a verified remaining-quota percentage or reset time. Foliquo shows the number of requests made by Foliquo and any usage-limit error the provider returns. Those local request counts are not the account-wide limit. A `subscription_sharing_usage_limit_exceeded` error pauses the translation queue and is recorded as a Foliquo-scoped limit signal; it does not establish that the entire ChatGPT plan is exhausted or when a limit resets.

## Dated API price table

The application rate table is dated **2026-10-29**. Prices below are USD per one million tokens, before discounts, taxes, credits or provider adjustments. Cost estimates use provider-reported input/output and cache details where available. For DeepSeek, Foliquo reports a peak/off-peak range. For models not listed in `lib/usage.mjs`, a cost is unavailable rather than inferred from a similar model.

### OpenAI API

| Model ID | Input | Output | Cached input |
|---|---:|---:|---:|
| `gpt-6-astra` | $10.00 | $50.00 | $1.00 |
| `gpt-6.1-sol` | $2.00 | $10.00 | $0.10 |
| `gpt-6.1-terra` | $1.00 | $5.00 | $0.05 |
| `gpt-6-luna` | $0.10 | $0.50 | $0.01 |

For prompts over 272,000 input tokens, the dated OpenAI table uses the long-context tier. GPT-6.1 Sol is $4.00 input, $0.20 cached input, $5.00 for a 30-minute cache write, $10.00 for a 12-hour write and $15.00 output. GPT-6 Luna is $0.20 input, $0.02 cached input, $0.25 for a 30-minute write, $0.50 for a 12-hour write and $0.75 output. GPT-6 Astra is $20.00 input, $2.00 cached input, $25.00/$50.00 cache writes and $75.00 output. Other OpenAI model IDs remain unpriced unless an exact model entry is added.

The API's reported cached input is priced separately. The local estimate does not include any future endpoint-specific, priority or other billing adjustment.

### Anthropic API

| Model ID | Input | Output | Cached input | Cache write, 5 min | Cache write, 1 hour |
|---|---:|---:|---:|---:|---:|
| `claude-fable-5-1` | $10.00 | $50.00 | $0.25 | $12.50 | $20.00 |
| `claude-opus-5-5` | $4.00 | $20.00 | $0.20 | $5.00 | $8.00 |
| `claude-sonnet-5-5` | $2.00 | $10.00 | $0.10 | $2.50 | $4.00 |
| `claude-haiku-5-5` (up to 100k prompt tokens) | $0.10 | $0.50 | $0.01 | $0.125 | $0.20 |
| `claude-haiku-5-5` (over 100k prompt tokens) | $0.50 | $2.50 | $0.05 | $0.625 | $1.00 |

The source stream reports cache reads and cache creation separately. If it reports cache-creation tokens without a 5-minute/1-hour breakdown, Foliquo counts the tokens but omits the cost estimate because the correct rate cannot be determined safely. Older supported Claude models have entries in the same rate table.

### DeepSeek API

| Model ID | Input cache miss | Input cache hit | Output | Estimate basis |
|---|---:|---:|---:|---|
| `deepseek-flash` | $0.15–$0.30 | $0.003–$0.006 | $0.60–$1.20 | Off-peak to peak |
| `deepseek-v4-pro` | $0.66–$1.32 | $0.022–$0.044 | $1.98–$3.96 | Off-peak to peak |

DeepSeek's off-peak rates are half the peak rates. Peak windows are 01:00–04:00 and 06:00–10:00 UTC on weekdays, excluding Chinese public holidays; the lower and upper values therefore bound the token-based estimate without guessing the applicable billing tier.

## Official price references

- [OpenAI API pricing](https://developers.openai.com/api/docs/pricing)
- [Anthropic API pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- [DeepSeek API models and pricing](https://api-docs.deepseek.com/quick_start/pricing)

Recheck these sources before changing `PRICE_VERSION` or the mappings. If a provider changes model IDs, rates, cache reporting or peak windows, unknown models should stay visibly unpriced until the local table is updated and checked.
