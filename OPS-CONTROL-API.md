# SSRP Operations Control API

The operations control API is mounted at `/api/control`. Every request must
include a valid session or permanent Stream Deck device token in the
`X-Session-Token` header (or `?token=`
for clients that cannot set headers). The API checks that a session exists; it
does not perform a user or permission lookup.

All mutating endpoints append an auditable facility event and broadcast
`event:created` to connected WebSocket clients. JSON request bodies are
required.

## Read the current control state

`GET /api/control`

Returns the current alarm, threat, and CDC values, active incidents, available
incident types, and the four warhead actions.

## Change site status

| Endpoint | Body |
|---|---|
| `POST /api/control/alarm` | `{ "value": "None" }` |
| `POST /api/control/threat` | `{ "value": "Low" }` |
| `POST /api/control/cdc` | `{ "value": "Off" }` |

Alarm values are `None`, `Class-D`, `Chaos Insurgency`, `Breach`, and
`Site Lockdown`. Threat values are `Low`, `Medium`, and `High`. CDC values are
`On` and `Off`.

## Mark a breach or incident

`POST /api/control/incident`

Create an active incident:

```json
{
  "incidentType": "containment_breach",
  "scp": "173",
  "state": "breached"
}
```

Contain it again by supplying the original event ID:

```json
{
  "incidentId": "event-uuid",
  "state": "contained"
}
```

If `incidentId` is omitted while containing, the newest active matching
`incidentType` (and optional `scp`) is resolved. Available incident types are:

`containment_breach`, `cdc_riot`, `chaos_incursion`, `site_lockdown`,
`perimeter_breach`, and `armed_contact`.

`scp` is required for all incident types except `cdc_riot`. A contained
incident is represented by a `BREACH_END` event linked to the original event.

## Warhead shortcuts

`POST /api/control/warhead`

Use one of these four actions:

```json
{ "action": "initialized" }
{ "action": "surface_sealed" }
{ "action": "exploded" }
{ "action": "autonuke" }
```

These map to the existing `WARHEAD` event stream and are intended as the
shortcuts for initializing, sealing, detonating, and starting the autonuke
sequence.

## Errors

Invalid values return `400`. A containment request without a matching active
incident returns `404`. Requests without a valid session or device token return `401`. Device tokens
are created once through `POST /api/auth/streamdeck-token` using an active
session and remain valid until the account is disabled or the token is
revoked by logging out with that token.
