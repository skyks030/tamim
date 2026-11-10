// Serves Google "Noto 3D" emoji images at /emoji/3d/<file>.png
//
// Images are downloaded on first use from the googlefonts/noto-emoji repository (pinned commit, 3D/png/128)
// and kept in <data>/emoji-cache, so each emoji is fetched only once and works offline afterwards.
// If the server has no internet, the request fails and the client falls back to the device emoji.

const fs = require('fs');
const path = require('path');

const NOTO_COMMIT = '99701e07d3d1fe1bdbcdb14964547f0fd592966f';
const SOURCES = [
  `https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@${NOTO_COMMIT}/3D/png/128/`,
  `https://raw.githubusercontent.com/googlefonts/noto-emoji/${NOTO_COMMIT}/3D/png/128/`
];
const NAME_RE = /^emoji_u[0-9a-f]{2,6}(?:_[0-9a-f]{2,6}){0,9}\.png$/;
const MAX_AGE = 30 * 24 * 3600 * 1000;

module.exports = function setupEmoji(app, dataDir) {
  const cacheDir = path.join(dataDir, 'emoji-cache', `noto3d-128-${NOTO_COMMIT.slice(0, 7)}`);
  fs.mkdirSync(cacheDir, { recursive: true });

  const missing = new Set();   // names that do not exist upstream (no image for this emoji)
  const inflight = new Map();  // name -> Promise<boolean>

  async function download(name) {
    let networkError = false;
    for (const base of SOURCES) {
      try {
        const res = await fetch(base + name, { signal: AbortSignal.timeout(8000) });
        if (res.status === 404) continue;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a png');
        const tmp = path.join(cacheDir, `${name}.${process.pid}.tmp`);
        await fs.promises.writeFile(tmp, buf);
        await fs.promises.rename(tmp, path.join(cacheDir, name));
        return true;
      } catch (e) {
        console.warn(`[Emoji] ${name} from ${new URL(base).host}: ${e.message}`);
        networkError = true; // try the next source; never remember as missing
      }
    }
    if (!networkError) missing.add(name);
    return false;
  }

  app.get('/emoji/3d/:name', async (req, res) => {
    const name = req.params.name;
    if (!NAME_RE.test(name) || missing.has(name)) return res.sendStatus(404);
    const file = path.join(cacheDir, name);
    if (!fs.existsSync(file)) {
      if (!inflight.has(name)) inflight.set(name, download(name).finally(() => inflight.delete(name)));
      const ok = await inflight.get(name);
      if (!ok) return res.sendStatus(missing.has(name) ? 404 : 502);
    }
    res.sendFile(file, { maxAge: MAX_AGE, immutable: true });
  });
};
