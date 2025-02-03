async function detectThreadSupport() {
  if (typeof MessageChannel !== "undefined") {
    // Test for transferability of SABs (needed for Firefox)
    // https://groups.google.com/forum/#!msg/mozilla.dev.platform/IHkBZlHETpA/dwsMNchWEQAJ
    new MessageChannel().port1.postMessage(new SharedArrayBuffer(1));
  }
  const moduleBytes = await (await fetch('thread-detect-module.wasm')).arrayBuffer();
  return WebAssembly.validate(moduleBytes);
}

// This function:
// - downloads the wasm code
// - creates the worker
// - initialized the worker
// - retrieves the exports and creates an object mirroring the symbols from the worker
// Returns an object that contains methods mirroring the module exports. Each
// methods returns a promise resolving to the returned value.
async function makeWorker(url, env) {
  const moduleBytes = await (await fetch(url)).arrayBuffer();
  const compilationResult = await WebAssembly.instantiate(moduleBytes, { env });

  const worker = new Worker(new URL('worker.js', import.meta.url), { type: 'module' });

  // The object that represent the worker at the application level
  const agent = {};
  // Will contain the names of the module's exported symbols
  let moduleExports;
  // Will contain the list of function calls in progress
  const outgoingCalls = {};
  // An ever increasing index of function calls
  let funid = 0;
  // The promise resolved once initialization completed
  let initResolve;
  let initPromise = new Promise(resolve => initResolve = resolve);

  // Listen for messages from the worker
  worker.onmessage = (event) => {
    console.log('Message from worker:', event.data);
    switch (event.data.type) {
    case 'ready': {
      moduleExports = event.data.moduleExports;
      console.log('moduleExports', moduleExports);
      for (let exp of moduleExports) {
        outgoingCalls[exp] = [];

        agent[exp] = async function() {
          const id = funid++;
          let resolve;
          let reject;
          const promise = new Promise((iresolve, ireject) => {
            resolve = iresolve;
            reject = ireject;
            worker.postMessage({
              type: 'functionCall',
              id,
              functionName: exp,
              functionArgs: Array.from(arguments),
            });
          });
          outgoingCalls[exp].push({ id, resolve, reject });
          return promise;
        }
      }

      initResolve(agent);
      break;
    }
    case 'functionResult': {
      const standingCalls = outgoingCalls[event.data.functionName];
      const index = standingCalls.findIndex(standingCall => standingCall.id === event.data.id);
      const standingCall = standingCalls.splice(index, 1);
      standingCall[0].resolve(event.data.result);
      break;
    }
    case 'functionFailure': {
      const standingCalls = outgoingCalls[event.data.functionName];
      const index = standingCalls.findIndex(standingCall => standingCall.id === event.data.id);
      const standingCall = standingCalls.splice(index, 1);
      standingCall[0].reject(event.data.error);
      break;
    }
    }
  };
  // Handle any errors in the worker
  worker.onerror = (error) => {
    console.error('Error in worker:', error.message);
  };

  // Initialize the worker
  worker.postMessage({
    type: '__init__',
    module: compilationResult.module,
    memory: env.memory,
  });

  return initPromise;
}

async function main() {
  console.log('ready');
  const threadDetected = await detectThreadSupport();
  if (!threadDetected) {
    throw new Error('thread NOT available');
  }

  const memory = new WebAssembly.Memory({ initial: 131072 / 65536, maximum: 1048576 / 65536, shared: true })
  const env = { memory };
  new Uint8Array(memory.buffer).fill(0);

  const worker = await makeWorker('fibonacci.wasm', env);
  console.log(await Promise.all(Array.from(Array(16).keys()).map(i => worker.fibonacci(i))));
}

window.onload = main;
