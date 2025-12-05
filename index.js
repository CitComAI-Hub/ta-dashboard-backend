const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.json());

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';
const USER = process.env.AUTH_USER || 'admin';
const PASS = process.env.AUTH_PASS || 'admin';
const TIR_BASE_URL = process.env.TIR_BASE_URL || 'http://tir:8080';

console.log('Auth backend config', {
  authUser: USER,
  tirBaseUrl: TIR_BASE_URL,
  jwtSecretProvided: Boolean(process.env.JWT_SECRET),
  customCreds: Boolean(process.env.AUTH_USER || process.env.AUTH_PASS),
});

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

app.post('/login', (req, res) => {
  const { username, password } = req.body;
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

app.post('/api/issuer', authMiddleware, async (req, res) => {
  try {
    const response = await fetch(`${TIR_BASE_URL}/issuer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });
    const data = await response.json().catch(() => ({}));
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error connecting to TIL', detail: err.message });
  }
});

// Nuevo: proxy DELETE /api/issuer/:did
app.delete('/api/issuer/:did', authMiddleware, async (req, res) => {
  try {
    const { did } = req.params;
    const response = await fetch(`${TIR_BASE_URL}/issuer/${did}`, {
      method: 'DELETE',
    });
    const data = await response.json().catch(() => ({}));
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error connecting to TIL', detail: err.message });
  }
});

// Proxy público para /api/v4/issuers
app.get('/api/v4/issuers', async (req, res) => {
  try {
    const response = await fetch(`${TIR_BASE_URL}/v4/issuers`);
    const data = await response.json().catch(() => ({}));
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error connecting to TIR', detail: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log('Auth backend listening on port', PORT);
}); 