# SSRP Stream Deck plugin

Copy `com.ssrp.ops-control.sdPlugin` into the Stream Deck plugins directory.
The plugin runtime needs Node.js and the package's `ws` dependency:

```sh
cd com.ssrp.ops-control.sdPlugin
npm install --omit=dev
```

Add any SSRP button, open its property inspector, and use **Save setup** once.
The plugin creates a permanent device token and stores it in global Stream
Deck settings; the password is cleared immediately. It provides 14 fixed
buttons: 5 alarm values, 3 threat values, 2 CDC states, and 4 warhead actions.
