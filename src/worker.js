// worker.js is treated as an ES module
import { malloc } from './libc.js';  // Import an ES module function

let env;
let instance;
let moduleExports;

onmessage = async (event) => {
  console.log('Message received in worker:', event.data);
  if (event.data.type === '__init__') {
    env = {
      memory: event.data.memory,
      malloc,
    };
    instance = await WebAssembly.instantiate(event.data.module, { env });
    moduleExports = Object.keys(instance.exports).filter(k => !k.startsWith('_'));
    postMessage({
      type: 'ready',
      moduleExports,
    });
  } else if (moduleExports === undefined) {
    throw new Error('Worker not initialized. postMessage with __init__ type first.');
  } else if (event.data.type == 'functionCall' && moduleExports.includes(event.data.functionName)) {
    try {
      const result = instance.exports[event.data.functionName](...event.data.functionArgs);
      postMessage({
        type: 'functionResult',
        id: event.data.id,
        functionName: event.data.functionName,
        result,
      });
    } catch (error) {
      postMessage({
        type: 'functionFailure',
        id: event.data.id,
        functionName: event.data.functionName,
        error,
      });
    }
  } else {
    throw new Error(`Unknown message type ${event.data}`);
  }
};

