# Hosted Hugging Face Setup

1. Sign in at https://huggingface.co/settings/tokens.
2. Create a fine-grained token named `skillpath-local`.
3. Enable **Make calls to Inference Providers**. Repository write access is unnecessary.
4. Add the following to the existing local `.env`, without replacing its other values:

```dotenv
HF_TOKEN=hf_your_private_token
HF_ROADMAP_MODEL=Qwen/Qwen2.5-72B-Instruct
```

Never paste the token in chat, commit it, or prefix it with `VITE_`. `.env` is ignored by Git. Check inference credits/billing in your Hugging Face account; calls can incur provider charges.

Restart the currently running backend after changing the file. Do not start another copy on the same ports. If running in your own terminal, use Ctrl+C followed by `npm run dev`. Otherwise ask the coding agent to restart its server.

Sign in, complete profile setup and the required assessment stages, then open Learning plan and select Generate learning plan. The server sends only the supported domain and anonymous per-skill evidence; it does not send names, email, answers, documents, or camera frames. The response is validated and persisted before the app displays it. Missing credentials, quota errors, and invalid output are explicit errors, not simulated successful generation.

The model is configurable because hosted model availability can change. A valid token alone does not prove that the selected provider/model is accessible. Real generation, factual lesson quality, and latency must still be checked with the configured account.

References:
- https://huggingface.co/docs/hub/security-tokens
- https://huggingface.co/docs/inference-providers/tasks/chat-completion
- https://huggingface.co/Qwen/Qwen2.5-72B-Instruct
