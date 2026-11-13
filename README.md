# SSRP Stream Deck plugin

The `streamdeck-plugin/com.ssrp.ops-control.sdPlugin` package controls the
endpoints documented in `OPS-CONTROL-API.md`.

1. Copy `streamdeck-plugin/com.ssrp.ops-control.sdPlugin` to the Stream Deck
   plugins directory, normally
   `%APPDATA%\Elgato\StreamDeck\Plugins`.
2. Restart Stream Deck.
3. Add any SSRP action and open its property inspector.
4. Enter the API URL, username, and password once, then click **Save setup**.
   The plugin exchanges the login session for a permanent device token and
   stores only that token in Stream Deck global settings.

There is one button for each alarm value (5), threat value (3), CDC value (2),
and warhead shortcut (4). The device token is stored hashed on the server and
is not shown again after creation. To reconfigure a deck locally, use **Clear
setup** and repeat the setup step.
The old device token remains valid until it is logged out or the account is
disabled.

## Linux autostart with systemd

The repository includes `systemd/ssrp-testing-logs.service`. Install and enable
it as root:

```bash
sudo cp systemd/ssrp-testing-logs.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ssrp-testing-logs.service
```

Check the service with:

```bash
systemctl status ssrp-testing-logs.service
journalctl -u ssrp-testing-logs.service -f
```

The unit currently targets the repository path `/root/ssrp-testing-logs` and
the Node.js binary installed by nvm at
`/root/.nvm/versions/node/v22.23.4/bin`. Update those paths in the unit if the
project or Node.js installation is moved.
