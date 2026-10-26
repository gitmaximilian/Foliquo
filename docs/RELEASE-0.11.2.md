# Foliquo Community 0.11.2

This patch fixes local AI setup stopping at “Not found” while leaving only a self-link visible. The missing private studio-draft routes are implemented, and restoring a draft no longer prevents access to AI settings.

- ChatGPT sign-in, granted plan scope, live model catalog, and a fictional English-to-German translation with real PDF and Word exports were verified on macOS.
- DeepSeek now authenticates against its actual model catalog before a model becomes ready. Diagnostics distinguish an anonymous network check from authenticated model access and translation success.
- OpenAI specialized audio/realtime/code models are excluded from this document workflow. Claude output limits respect catalog metadata, with a conservative fallback.
- Slow model responses cannot overwrite a different provider selection.
- The theme switch sits immediately above interface language. The language-swap control has 16px clearance on both sides on desktop.
- Connection management and diagnostics use matching adjacent buttons with independently expandable panels.

API-provider success with a real OpenAI API, Anthropic or DeepSeek account was not tested because no API keys were supplied. Automated protocol/error-path tests are not represented as live provider acceptance. No personal documents were sent during validation.

The browser/loopback architecture, persistent private-data location and PolyForm Noncommercial license are unchanged. Update using Homebrew or your platform's new versioned installer/archive. WinGet package approval remains separate from this release.
