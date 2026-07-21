/* Wakti Cinema – classic Web Worker for FFmpeg.wasm
   ─────────────────────────────────────────────────────────────────────────────
   WHY classic (not module) worker?
   @ffmpeg/ffmpeg v0.12's built-in worker uses { type:"module" } which breaks
   in Vite production builds (wrong import.meta.url after bundling → Worker
   fails silently → 60s timeout). Classic workers support importScripts() which
   loads the UMD ffmpeg-core.js perfectly from the same origin, zero issues.

   Protocol: mirrors @ffmpeg/ffmpeg v0.12's message format so the existing
   useFFmpegVideo hook works unchanged.
   ─────────────────────────────────────────────────────────────────────────────
*/

var ffmpegCore = null;

self.onmessage = async function (event) {
  var id   = event.data.id;
  var type = event.data.type;
  var data = event.data.data;
  var transfer = [];
  var result;

  try {
    switch (type) {
      case 'LOAD':        result = await doLoad(data);        break;
      case 'EXEC':        result = doExec(data);              break;
      case 'WRITE_FILE':  result = doWriteFile(data);         break;
      case 'READ_FILE':   result = doReadFile(data);          break;
      case 'DELETE_FILE': result = doDeleteFile(data);        break;
      default: throw new Error('Unknown message type: ' + type);
    }
    if (result instanceof Uint8Array) transfer.push(result.buffer);
    self.postMessage({ id: id, type: type, data: result }, transfer);
  } catch (err) {
    self.postMessage({
      id:   id,
      type: 'ERROR',
      data: String(err && err.message ? err.message : err),
    });
  }
};

async function doLoad(config) {
  if (ffmpegCore) return false; // already initialised

  var coreURL = config.coreURL || '/ffmpeg/ffmpeg-core.js';
  var wasmURL = config.wasmURL || '/ffmpeg/ffmpeg-core.wasm';

  // importScripts works in classic workers and loads the UMD bundle fine.
  // The UMD file exposes `createFFmpegCore` as a top-level var → becomes
  // a property of `self` (the worker's global object).
  importScripts(coreURL);

  if (typeof createFFmpegCore !== 'function') {
    throw new Error('createFFmpegCore not found after importScripts – check /ffmpeg/ffmpeg-core.js');
  }

  // locateFile tells Emscripten exactly where the .wasm file lives.
  ffmpegCore = await createFFmpegCore({
    locateFile: function (path) {
      if (path.indexOf('.wasm') !== -1) return wasmURL;
      return path;
    },
  });

  ffmpegCore.setLogger(function (data) {
    self.postMessage({ type: 'LOG', data: data });
  });
  ffmpegCore.setProgress(function (data) {
    self.postMessage({ type: 'PROGRESS', data: data });
  });

  return true;
}

function doExec(data) {
  if (!ffmpegCore) throw new Error('FFmpeg core not loaded');
  var timeout = (data.timeout !== undefined && data.timeout > 0) ? data.timeout : -1;
  ffmpegCore.setTimeout(timeout);
  ffmpegCore.exec.apply(ffmpegCore, data.args);
  var ret = ffmpegCore.ret;
  ffmpegCore.reset();
  if (ret !== 0) throw new Error('FFmpeg exited with code ' + ret);
  return ret;
}

function doWriteFile(data) {
  if (!ffmpegCore) throw new Error('FFmpeg core not loaded');
  ffmpegCore.FS.writeFile(data.path, data.data);
  return true;
}

function doReadFile(data) {
  if (!ffmpegCore) throw new Error('FFmpeg core not loaded');
  return ffmpegCore.FS.readFile(data.path, { encoding: data.encoding || 'binary' });
}

function doDeleteFile(data) {
  if (!ffmpegCore) throw new Error('FFmpeg core not loaded');
  try { ffmpegCore.FS.unlink(data.path); } catch (_) {}
  return true;
}
