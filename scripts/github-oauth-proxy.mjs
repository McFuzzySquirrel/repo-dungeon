import { createServer } from 'node:http';

const port = Number.parseInt(process.env.PORT ?? '8787', 10);
const clientSecret = process.env.GITHUB_CLIENT_SECRET;

if (!clientSecret) {
  console.error('Missing GITHUB_CLIENT_SECRET environment variable.');
  process.exit(1);
}

const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,https://mcfuzzysquirrel.github.io')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);

function getCorsHeaders(origin) {
  const resolvedOrigin = origin && allowedOrigins.has(origin) ? origin : null;

  return {
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Origin': resolvedOrigin ?? 'null',
    Vary: 'Origin',
  };
}

function sendJson(response, status, payload, origin) {
  response.writeHead(status, {
    ...getCorsHeaders(origin),
    'Content-Type': 'application/json',
  });
  response.end(JSON.stringify(payload));
}

async function readRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

const server = createServer(async (request, response) => {
  const origin = request.headers.origin;

  if (request.method === 'OPTIONS') {
    response.writeHead(204, getCorsHeaders(origin));
    response.end();
    return;
  }

  if (request.method !== 'POST' || request.url !== '/api/github/oauth/exchange') {
    sendJson(response, 404, { error: 'Not found.' }, origin);
    return;
  }

  if (origin && !allowedOrigins.has(origin)) {
    sendJson(response, 403, { error: 'Origin is not allowed.' }, origin);
    return;
  }

  let payload;
  try {
    payload = JSON.parse(await readRequestBody(request));
  } catch {
    sendJson(response, 400, { error: 'Request body must be valid JSON.' }, origin);
    return;
  }

  const clientId = typeof payload.clientId === 'string' ? payload.clientId.trim() : '';
  const code = typeof payload.code === 'string' ? payload.code.trim() : '';
  const codeVerifier = typeof payload.code_verifier === 'string' ? payload.code_verifier.trim() : '';
  const redirectUri = typeof payload.redirect_uri === 'string' ? payload.redirect_uri.trim() : '';

  if (!clientId || !code || !codeVerifier || !redirectUri) {
    sendJson(response, 400, { error: 'Missing required OAuth exchange fields.' }, origin);
    return;
  }

  try {
    const exchangeResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri,
      }),
    });

    const responseText = await exchangeResponse.text();
    response.writeHead(exchangeResponse.status, {
      ...getCorsHeaders(origin),
      'Content-Type': 'application/json',
    });
    response.end(responseText);
  } catch (error) {
    sendJson(
      response,
      502,
      { error: error instanceof Error ? error.message : 'Token exchange failed.' },
      origin,
    );
  }
});

server.listen(port, () => {
  console.log(`GitHub OAuth proxy listening on http://localhost:${port}/api/github/oauth/exchange`);
});