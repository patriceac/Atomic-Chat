# Read replies with bundled offline neural voices

The Windows chat adds Read aloud / Stop to assistant replies and voice, language,
speed, preview and opt-in automatic reading to Voice settings. Supertonic 3
replaces the low-quality Windows voices. Ten voice styles support English and
French. Model assets are bundled and checked against their pinned source hashes.
The user approved onnxruntime-node 1.30.0 for CPU inference using the app's
existing Bun runtime. A private stdio worker caches the model; no HTTP server,
cloud speech service or GPU allocation is needed. It exits when the app closes.

Only final successful completions trigger automatic reading. Opening history
does not trigger speech. Reasoning and code blocks are excluded. Playback is
chunked with one chunk prepared ahead. Cancellation invalidates pending audio
before stopping playback, so a late result cannot restart an old reply.
Navigating away stops speech. Code uses MIT-licensed Supertonic helpers and
ONNX Runtime; the bundled model carries its OpenRAIL-M license.

The custom release is identified as `2.1.2+tts.2`; later official app updates
need these changes reapplied unless they include equivalent functionality.
