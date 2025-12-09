const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const AbortController = global.AbortController || require('abort-controller');

const app = express();
const requiredEnv = ['JWT_SECRET', 'AUTH_USER', 'AUTH_PASS', 'TIR_BASE_URL', 'ALLOWED_ORIGINS'];
const missingEnv = requiredEnv.filter((name) => !process.env[name]);
if (missingEnv.length) {
  console.error('Missing required environment variables:', missingEnv.join(', '));
  process.exit(1);
}

const {
  JWT_SECRET,
  AUTH_USER: USER,
  AUTH_PASS: PASS,
  TIR_BASE_URL,
  ALLOWED_ORIGINS,
  FETCH_TIMEOUT_MS = '5000',
  JSON_BODY_LIMIT = '1mb',
  RATE_LIMIT_WINDOW_MS = String(15 * 60 * 1000),
  RATE_LIMIT_MAX = '200',
} = process.env;

const allowedOrigins = ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean);
if (!allowedOrigins.length) {
  console.error('ALLOWED_ORIGINS must contain at least one allowed domain.');
  process.exit(1);
}

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true,
};

app.use(helmet());
app.use(cors(corsOptions));
app.use((err, req, res, next) => {
  if (err && err.message === 'Origin not allowed by CORS') {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  return next(err);
});
app.use(bodyParser.json({ limit: JSON_BODY_LIMIT }));
app.use(
  rateLimit({
    windowMs: Number(RATE_LIMIT_WINDOW_MS),
    max: Number(RATE_LIMIT_MAX),
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

function ensureJsonObject(req, res, next) {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Request body must be a JSON object' });
  }
  return next();
}

const FETCH_TIMEOUT = Number(FETCH_TIMEOUT_MS);

async function forwardToTir(path, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const response = await fetch(`${TIR_BASE_URL}${path}`, { ...options, signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  } finally {
    clearTimeout(timeoutId);
  }
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({                       error: 'Invalid token' });
  }
}

app.post('/login', ensureJsonObject, (req, res) => {
  const { username, password } = req.body;
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  if (username === USER && password === PASS) {
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '8h' });
    return res.json({ token });
  }
  return res.status(401).json({ error: 'Invalid credentials' });
});

app.get('/me', authMiddleware, (req, res) => {
  res.json({ username: req.user.username });
});

app.post('/logout', (req, res) => {
  // No-op for JWT, handled on frontend
  res.json({ ok: true });
});

app.post('/api/issuer', authMiddleware, ensureJsonObject, async (req, res) => {
  try {
    const { response, data } = await forwardToTir('/issuer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });
    res.status(response.status).json(data);
  } catch (err) {
    const status = err.name === 'AbortError' ? 504 : 502;
    res.status(status).json({ error: 'Error connecting to TIR', detail: err.message });
  }
});

// Nuevo: proxy DELETE /api/issuer/:did
app.delete('/api/issuer/:did', authMiddleware, async (req, res) => {
  try {
    const { did } = req.params;
    const { response, data } = await forwardToTir(`/issuer/${did}`, {
      method: 'DELETE',
    });
    res.status(response.status).json(data);
  } catch (err) {
    const status = err.name === 'AbortError' ? 504 : 502;
    res.status(status).json({ error: 'Error connecting to TIR', detail: err.message });
  }
});

// Proxy público para /api/v4/issuers
app.get('/api/v4/issuers', async (req, res) => {
  try {
    const { response, data } = await forwardToTir('/v4/issuers');
    res.status(response.status).json(data);
  } catch (err) {
    const status = err.name === 'AbortError' ? 504 : 502;
    res.status(status).json({ error: 'Error connecting to TIR', detail: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log('Auth backend listening on port', PORT);
}); 