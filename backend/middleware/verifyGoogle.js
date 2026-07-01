const crypto = require('crypto');

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

let cachedKeys = null;
let cacheExpiry = 0;

async function fetchGoogleKeys() {
  if (cachedKeys && Date.now() < cacheExpiry) return cachedKeys;

  try {
    const res = await fetch(GOOGLE_JWKS_URL);
    const { keys } = await res.json();
    const map = {};
    for (const key of keys) {
      map[key.kid] = key;
    }
    cachedKeys = map;
    cacheExpiry = Date.now() + 3600000;
    return map;
  } catch (err) {
    console.error('Failed to fetch Google JWKS keys:', err.message);
    if (cachedKeys) return cachedKeys;
    throw err;
  }
}

function pemFromJwk(jwk) {
  const n = Buffer.from(jwk.n, 'base64url').toString('base64');
  const e = Buffer.from(jwk.e, 'base64url').toString('base64');
  const pubKey = `-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA\n${n}\n${e}\n-----END PUBLIC KEY-----`;
  return pubKey;
}

function base64UrlDecode(str) {
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

async function verifyGoogle(req, res, next) {
  const authHeader = req.header('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);

  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }

    const header = JSON.parse(base64UrlDecode(parts[0]).toString());
    const payload = JSON.parse(base64UrlDecode(parts[1]).toString());

    const expectedAud = process.env.GOOGLE_PUBSUB_AUDIENCE;
    if (expectedAud && payload.aud !== expectedAud) {
      return res.status(401).json({ error: 'Invalid JWT audience' });
    }

    if (payload.iss !== 'accounts.google.com' && payload.iss !== 'https://accounts.google.com') {
      return res.status(401).json({ error: 'Invalid JWT issuer' });
    }

    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return res.status(401).json({ error: 'JWT has expired' });
    }

    const keys = await fetchGoogleKeys();
    const jwk = keys[header.kid];
    if (!jwk) {
      return res.status(401).json({ error: 'Unknown signing key' });
    }

    const signature = base64UrlDecode(parts[2]);
    const data = Buffer.from(parts[0] + '.' + parts[1]);

    const keyObj = crypto.createPublicKey({
      key: {
        kty: jwk.kty,
        n: jwk.n,
        e: jwk.e,
        alg: jwk.alg || 'RS256',
      },
      format: 'jwk',
    });

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(data);
    const valid = verifier.verify(keyObj, signature);

    if (!valid) {
      return res.status(401).json({ error: 'Invalid JWT signature' });
    }

    req.googlePayload = payload;
    next();
  } catch (err) {
    console.error('Google JWT verification failed:', err.message);
    return res.status(401).json({ error: 'JWT verification failed' });
  }
}

module.exports = verifyGoogle;
