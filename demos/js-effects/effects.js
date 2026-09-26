// Bend's compiler resolves constructor IDs and provides io_eff.
// browserHost is injected per run by the browser adapter.
// Strings and U32 cross this boundary as ordinary JS values.

io_eff(CID(Web.message), () => browserHost.message());

// Our browser runner awaits Promises before resuming Bend.
io_eff(CID(Web.palette), async () => browserHost.palette());

io_eff(CID(Web.paint), (message, hue) => {
  browserHost.paint(message, hue);
  return { $: CID(Unit) };
});

io_eff(CID(Web.delay), () => browserHost.delay());

io_eff(CID(Web.sleep), async (ms) => {
  await browserHost.sleep(ms);
  return { $: CID(Unit) };
});

io_eff(CID(Web.save), (message) => {
  // The JS backend represents Bend Bool as a native boolean.
  return browserHost.save(message);
});

io_eff(CID(Web.finish), (message) => {
  browserHost.finish(message);
  return { $: CID(Unit) };
});
