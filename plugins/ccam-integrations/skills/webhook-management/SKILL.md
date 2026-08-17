---
name: webhook-management
description: >
  Configure and validate CCAM webhook targets across supported chat, incident,
  automation, and generic providers. Use when listing provider requirements,
  creating or updating a target, scoping it to alert rules, sending a test
  notification, reviewing delivery history, or deleting a target.
---

# Webhook Management

1. Run `ccam webhooks providers` and select the exact provider key.
2. Run `ccam webhooks` to inspect existing redacted targets.
3. Build the JSON body in a local file. Keep tokens, routing keys, and webhook
   URLs out of chat and logs.
4. Show the target name, provider, rule scope, and whether a real test message
   will be sent.
5. Create or update only after confirmation:

```bash
ccam webhooks create --file /secure/path/target.json --yes
ccam webhooks update <id> --file /secure/path/patch.json --yes
```

6. Ask again before `ccam webhooks test <id>`. It sends an external message.
7. Inspect results with `ccam webhooks deliveries <id>`.

Never print secret fields. The dashboard returns masked values by design.
