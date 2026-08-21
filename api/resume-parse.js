const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const WordExtractor = require('word-extractor');

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TEXT_CHARS = 12000;

function decodeBase64File(base64) {
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length > MAX_FILE_BYTES) {
    throw new Error('File is too large. Maximum size is 5 MB.');
  }
  return buffer;
}

function normalizeText(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[^\S\n]+/g, ' ')
    .trim()
    .slice(0, MAX_TEXT_CHARS);
}

async function extractFromPdf(buffer) {
  const data = await pdfParse(buffer);
  return data.text || '';
}

async function extractFromDocx(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return result.value || '';
}

async function extractFromDoc(buffer) {
  const extractor = new WordExtractor();
  const doc = await extractor.extract(buffer);
  return doc.getBody() || '';
}

async function extractFromTxt(buffer) {
  return buffer.toString('utf8');
}

function getExtension(fileName = '') {
  const parts = fileName.toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() : '';
}

async function extractResumeText({ base64, fileName, mimeType }) {
  if (!base64) {
    throw new Error('File data is required');
  }

  const buffer = decodeBase64File(base64);
  const ext = getExtension(fileName);
  const type = (mimeType || '').toLowerCase();

  let text = '';

  if (ext === 'txt' || type === 'text/plain') {
    text = await extractFromTxt(buffer);
  } else if (ext === 'pdf' || type === 'application/pdf') {
    text = await extractFromPdf(buffer);
  } else if (
    ext === 'docx' ||
    type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    text = await extractFromDocx(buffer);
  } else if (ext === 'doc' || type === 'application/msword') {
    text = await extractFromDoc(buffer);
  } else {
    throw new Error('Unsupported file type. Please upload PDF, DOC, DOCX, or TXT.');
  }

  const normalized = normalizeText(text);
  if (!normalized) {
    throw new Error('Could not extract text from this file. Try a different format or a text-based PDF.');
  }

  return normalized;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { base64, fileName, mimeType } = req.body || {};
    const text = await extractResumeText({ base64, fileName, mimeType });
    return res.status(200).json({ text, fileName: fileName || 'resume' });
  } catch (err) {
    console.error('Resume parse error:', err);
    return res.status(400).json({ error: err.message || 'Failed to parse resume' });
  }
};

module.exports.extractResumeText = extractResumeText;
