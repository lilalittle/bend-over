// Bend's compiler resolves constructor IDs and provides io_eff.
// browserHost is injected per run by the browser adapter.
// Strings and U32 cross this boundary as ordinary JS values.

io_eff(CID(message), () => browserHost.message());

// Our browser runner awaits Promises before resuming Bend.
io_eff(CID(palette), async () => browserHost.palette());

io_eff(CID(paint), (message, hue) => {
  browserHost.paint(message, hue);
  return { $: CID(Unit) };
});

io_eff(CID(delay), () => browserHost.delay());

io_eff(CID(sleep), async (ms) => {
  await browserHost.sleep(ms);
  return { $: CID(Unit) };
});

io_eff(CID(save), (message) => {
  // The JS backend represents Bend Bool as a native boolean.
  return browserHost.save(message);
});

io_eff(CID(finish), (message) => {
  browserHost.finish(message);
  return { $: CID(Unit) };
});
