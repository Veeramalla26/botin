require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') });
const express = require('express');
const cors = require('cors');
const chatHandler = require('../api/chat');

const app = express();
const PORT = process.env.API_PORT || 3001;

const transcribeHandler = require('../api/transcribe');
const resumeParseHandler = require('../api/resume-parse');

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.all('/api/chat', async (req, res) => {
  await chatHandler(req, res);
});

app.all('/api/transcribe', async (req, res) => {
  await transcribeHandler(req, res);
});

app.all('/api/resume-parse', async (req, res) => {
  await resumeParseHandler(req, res);
});

app.get('/health', (_, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Local API running on http://localhost:${PORT}`);
});
