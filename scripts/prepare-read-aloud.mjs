import fs from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destination = path.join(root, 'src-tauri/resources/tts');
const require = createRequire(import.meta.url);
const revision = 'aafc6e32416a594460b32413efc49d7fe4ce6d46';
const assets = [
  {
    "path": "LICENSE",
    "hash": "1e2cbe6cef94c8cdf3ed1fcebc0f5317ca7ad5a1",
    "lfs": false
  },
  {
    "path": "onnx/duration_predictor.onnx",
    "hash": "c3eb91414d5ff8a7a239b7fe9e34e7e2bf8a8140d8375ffb14718b1c639325db",
    "lfs": true
  },
  {
    "path": "onnx/text_encoder.onnx",
    "hash": "c7befd5ea8c3119769e8a6c1486c4edc6a3bc8365c67621c881bbb774b9902ff",
    "lfs": true
  },
  {
    "path": "onnx/tts.json",
    "hash": "28575b0793c92607a0f0a292550df9bd17709a79",
    "lfs": false
  },
  {
    "path": "onnx/unicode_indexer.json",
    "hash": "3aaf4d33024aff0be455633c24b3636b3a810150",
    "lfs": false
  },
  {
    "path": "onnx/vector_estimator.onnx",
    "hash": "883ac868ea0275ef0e991524dc64f16b3c0376efd7c320af6b53f5b780d7c61c",
    "lfs": true
  },
  {
    "path": "onnx/vocoder.onnx",
    "hash": "085de76dd8e8d5836d6ca66826601f615939218f90e519f70ee8a36ed2a4c4ba",
    "lfs": true
  },
  {
    "path": "voice_styles/F1.json",
    "hash": "421365f307ed1535d8da16845031d0e9fa3e60c5",
    "lfs": false
  },
  {
    "path": "voice_styles/F2.json",
    "hash": "b09a3a433df8a4856d1d7d64736a56ddf37a4ea3",
    "lfs": false
  },
  {
    "path": "voice_styles/F3.json",
    "hash": "a366f94c77c4b440404071f1a52bed3ccf83a5ff",
    "lfs": false
  },
  {
    "path": "voice_styles/F4.json",
    "hash": "39c78a52795320c6101b7eaf984c0e2352fbdc18",
    "lfs": false
  },
  {
    "path": "voice_styles/F5.json",
    "hash": "06983f8816ad00a8eeb7efd37a33d457587e16f8",
    "lfs": false
  },
  {
    "path": "voice_styles/M1.json",
    "hash": "bddfff85a7c4c140c11620bd7005d86681dccdac",
    "lfs": false
  },
  {
    "path": "voice_styles/M2.json",
    "hash": "602ff6c4d6d48cdb71c37461f7c175d71fe8b34b",
    "lfs": false
  },
  {
    "path": "voice_styles/M3.json",
    "hash": "000b60436b77619b933fdc33628ad737595e6794",
    "lfs": false
  },
  {
    "path": "voice_styles/M4.json",
    "hash": "aae253ae81185fa06a6469c3f1cdff04ed121ddf",
    "lfs": false
  },
  {
    "path": "voice_styles/M5.json",
    "hash": "0536b252698830f8536c077edcb94e1ce4768ab6",
    "lfs": false
  }
];
async function digest(filename, asset) {
  const hash = createHash(asset.lfs ? 'sha256' : 'sha1');
  if (!asset.lfs) hash.update('blob ' + (await fs.stat(filename)).size + '\0');
  for await (const bytes of createReadStream(filename)) hash.update(bytes);
  return hash.digest('hex');
}
await fs.mkdir(destination, {recursive:true});
for (const asset of assets) {
  const target=path.join(destination,asset.path);
  if (existsSync(target) && await digest(target,asset)===asset.hash) continue;
  const response=await fetch('https://huggingface.co/supertone-oss-archive/supertonic-3/resolve/'+revision+'/'+asset.path);
  if (!response.ok) throw new Error('Speech asset download failed: '+asset.path);
  await fs.mkdir(path.dirname(target),{recursive:true});
  await fs.writeFile(target,new Uint8Array(await response.arrayBuffer()));
  if (await digest(target,asset)!==asset.hash) throw new Error('Speech asset hash mismatch: '+asset.path);
}
function packageRoot(name) {
  let directory=path.dirname(require.resolve(name));
  while (directory!==path.dirname(directory)) {
    const manifest=path.join(directory,'package.json');
    if (existsSync(manifest) && require(manifest).name===name) return directory;
    directory=path.dirname(directory);
  }
  throw new Error('Missing speech runtime: '+name);
}
for (const name of ['onnxruntime-node','onnxruntime-common']) {
  const source=packageRoot(name), target=path.join(destination,'node_modules',name);
  await fs.mkdir(target,{recursive:true});
  await fs.copyFile(path.join(source,'package.json'),path.join(target,'package.json'));
  await fs.cp(path.join(source,'dist'),path.join(target,'dist'),{recursive:true});
  if (name==='onnxruntime-node') {
    const native='bin/napi-v6/win32/x64';
    await fs.cp(path.join(source,native),path.join(target,native),{recursive:true});
  }
}
for (const name of ['read-aloud-worker.mjs','supertonic.mjs'])
  await fs.copyFile(path.join(root,'scripts',name),path.join(destination,name));
for (const name of ['read-aloud-supertonic-LICENSE.txt','read-aloud-runtime-LICENSE.txt'])
  await fs.copyFile(path.join(root,'src-tauri/licenses',name),path.join(destination,name));
console.log('Bundled Supertonic 3, ten voices and native CPU runtime.');
