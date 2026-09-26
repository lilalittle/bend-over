import sqlite3InitModule from "./vendor/index.mjs";
import { initializeSQLite } from "./host.js";
import { runCounter } from "./counter.js";

let host;
const ready = initializeSQLite({ persistent: true, initModule: sqlite3InitModule })
  .then(value => { host = value; return { ok: true }; })
  .catch(error => ({ ok: false, error: error.message }));
// Serialize messages: a callback owns its connection until it completes.
let queue = Promise.resolve();
self.onmessage = ({data}) => {
  queue = queue.then(async () => {
    try {
      const initialized = await ready;
      if (!initialized.ok) throw new Error(initialized.error);
      if (data.type === "dispose") { host.dispose(); self.postMessage({id:data.id,ok:true}); self.close(); return; }
      if (data.type === "ready") { self.postMessage({id:data.id,ok:true}); return; }
      if (data.type === "contract") {
        const {runContract} = await import("./contract.js");
        await runContract(); self.postMessage({id:data.id,ok:true}); return;
      }
      const result = await runCounter(data.path ?? "/counter.sqlite", data.type === "increment");
      if (result.$ === "Fail") throw new Error(result.error.snd);
      self.postMessage({id:data.id,ok:true,value:result.value});
    } catch (error) { self.postMessage({id:data.id,ok:false,error:error.message}); }
  });
};
