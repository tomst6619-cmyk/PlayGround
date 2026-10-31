import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, watch, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const root = resolve(process.cwd());
const port = Number(process.env.PORT || 3000);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.glb': 'model/gltf-binary',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
};

if (process.env.OPENCODE_WEB_DIR) {
  mkdirSync(process.env.OPENCODE_WEB_DIR, { recursive: true });
  writeFileSync(
    join(process.env.OPENCODE_WEB_DIR, 'deployment-output.json'),
    JSON.stringify({ project: root, directory: root }),
  );
}

const clients = new Set();
let debounce;

try {
  watch(root, { recursive: true }, (_event, filename) => {
    if (!filename || /(^|\/)(\.git|\.agents|node_modules|screenshots)(\/|$)/.test(filename)) return;
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      for (const client of clients) client.write('event: change\ndata: changed\n\n');
    }, 180);
  });
} catch {
  // Live reload is a convenience; static serving still works without it.
}

const server = createServer((request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/__omgithub/live') {
      response.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
        Connection: 'keep-alive',
      });
      response.write(': connected\n\n');
      clients.add(response);
      request.on('close', () => clients.delete(response));
      return;
    }

    const pathname = decodeURIComponent(url.pathname);
    const target = resolve(root, `.${pathname}`);
    if (target !== root && !target.startsWith(root + '/')) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }

    let file = target;
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(target, 'index.html');
    if (!existsSync(file) || !statSync(file).isFile()) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }

    const extension = extname(file).toLowerCase();
    response.writeHead(200, {
      'Content-Type': mime[extension] || 'application/octet-stream',
      'Cache-Control': url.searchParams.has('omgithub_live') ? 'no-store' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });

    if (extension === '.html' && url.searchParams.get('omgithub_live') === '1') {
      const html = readFileSync(file, 'utf8');
      const live = `<script data-omgithub-live-preview>
(() => {
  const events = new EventSource('/__omgithub/live');
  events.addEventListener('change', () => {
    if (window.parent !== window) window.parent.postMessage({ type: 'omgithub:live-change' }, '*');
    else window.location.reload();
  });
  window.addEventListener('pagehide', () => events.close(), { once: true });
})();
</script>`;
      response.end(/<\/body\s*>/i.test(html) ? html.replace(/<\/body\s*>/i, `${live}</body>`) : html + live);
      return;
    }

    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(500);
    response.end('Server error');
  }
});

setInterval(() => {
  for (const client of clients) client.write(': keepalive\n\n');
}, 20_000).unref();

server.listen(port, '0.0.0.0', () => {
  console.log(`Ufos schauen läuft auf http://localhost:${port}`);
});
