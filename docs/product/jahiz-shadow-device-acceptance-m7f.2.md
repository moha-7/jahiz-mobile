# Jahiz M7F.2 — Real-Device Parity Diagnostics + Acceptance Harness

## Goal

Make observe-only parity evidence visible on a physical development device and provide a repeatable local acceptance harness.

Server authority remains off.

## Diagnostics overlay

The overlay is rendered only when:

- `__DEV__` is true
- `EXPO_PUBLIC_JAHIZ_SHADOW_DIAGNOSTICS=1`

It shows aggregate operational evidence only:

- observe enabled / disabled
- review gate state
- sessions
- observations
- parity-same percentage
- conflict percentage
- unavailable percentage
- bootstrap divergence
- server divergence
- invalid responses
- unauthorized outcomes
- cutover-review blockers

It never displays trip, route, destination, funds, costs, commitments, payments, or Money In.

## Device acceptance harness

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\jahiz-shadow-device-acceptance.ps1
```

The harness:

1. detects the PC LAN IPv4 address
2. starts Docker PostgreSQL
3. provisions an isolated `jahiz_m7f2_device` role/database
4. starts a development-only Fastify API on `0.0.0.0:4010`
5. verifies `/health`
6. injects explicit Expo public observe variables into the Metro process
7. launches Expo with `expo start --clear`
8. stops the temporary API when the Expo session ends

No tracked source is modified by the acceptance harness.

## Real-device acceptance

Use a physical phone on the same LAN as the development PC.

For the first session, success means:

- SHADOW diagnostics button appears
- Observe is Enabled
- authority remains local
- at least one observation is recorded after a real edit
- bootstrap divergence = 0
- server divergence = 0
- invalid responses = 0
- unauthorized = 0

The conservative cutover review gate still requires more evidence over multiple sessions.

Do not manufacture 25 edits only to satisfy the threshold.

## Network notes

If the phone cannot reach the API:

- confirm PC and phone are on the same Wi-Fi/LAN
- allow Node through Windows Firewall on Private networks
- verify the displayed PC LAN IP
- re-run with `-MobileHost <PC-LAN-IP>` if auto-detection selected the wrong adapter

Android Emulator may use `-MobileHost 10.0.2.2`.

## Authority

M7F.2 does not:

- read server state into Zustand
- alter local financial truth
- enable production authentication
- automatically cut over to server authority

The diagnostics screen can only report whether evidence is ready for **human review**.
