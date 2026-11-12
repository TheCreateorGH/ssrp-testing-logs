# SSRP Stream Deck plugin

The `com.ssrp.ops-control.sdPlugin` package controls the endpoints documented in
`OPS-CONTROL-API.md`.

1. Copy `streamdeck-plugin/com.ssrp.ops-control.sdPlugin` to the Stream Deck
   plugins directory, normally
   `%APPDATA%\Elgato\StreamDeck\Plugins`.
2. Restart Stream Deck.
3. Add an SSRP action and configure the API base URL and a valid SSRP session
   token in its property inspector.

Actions are available for alarm, threat, CDC, incident creation, incident
containment, warhead shortcuts, and a live control snapshot. The plugin uses
the existing root `ws` dependency and Node's built-in `fetch`.
