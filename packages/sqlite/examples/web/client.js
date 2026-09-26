export function createCounter() {
  const worker = new Worker(new URL("./worker.js", import.meta.url), {type:"module"});
  let sequence = 0, stopped = false;
  const waiting = new Map();
  const rejectAll = error => { for (const request of waiting.values()) request.reject(error); waiting.clear(); };
  worker.onmessage = ({data}) => {
    const pending = waiting.get(data.id);
    if (!pending) return;
    waiting.delete(data.id);
    data.ok ? pending.resolve(data.value) : pending.reject(new Error(data.error));
  };
  worker.onerror = event => rejectAll(new Error(event.message));
  function call(type, path) {
    if (stopped) return Promise.reject(new Error("Worker has been stopped."));
    const id = ++sequence;
    return new Promise((resolve,reject) => { waiting.set(id,{resolve,reject}); worker.postMessage({id,type,path}); });
  }
  return {
    ready: () => call("ready"),
    read: path => call("read",path),
    increment: path => call("increment",path),
    contract: () => call("contract"),
    async dispose() { try { await call("dispose"); } finally { this.terminate(); } },
    terminate() { stopped = true; worker.terminate(); rejectAll(new Error("Worker terminated.")); },
  };
}
