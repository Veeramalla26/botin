const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const { generateResponse } = require('../services/aiService');

async function createSession(req, res) {
  try {
    const { userName, company } = req.body;
    const id = uuidv4();
    await pool.execute(
      'INSERT INTO sessions (id, user_name, company) VALUES (?, ?, ?)',
      [id, userName || 'Guest', company || null]
    );
    res.json({ id, userName: userName || 'Guest', company });
  } catch (err) {
    console.error('Create session error:', err);
    res.status(500).json({ error: 'Failed to create session' });
  }
}

async function getSession(req, res) {
  try {
    const [sessions] = await pool.execute('SELECT * FROM sessions WHERE id = ?', [req.params.id]);
    if (!sessions.length) return res.status(404).json({ error: 'Session not found' });
    res.json(sessions[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get session' });
  }
}

async function generateAndSave(req, res) {
  try {
    const { sessionId, prompt, mode, questionText, previousResponse } = req.body;

    if (!sessionId || (!prompt && !questionText)) {
      return res.status(400).json({ error: 'sessionId and prompt are required' });
    }

    const responseText = await generateResponse(prompt, mode || 'send', {
      questionText,
      previousResponse,
    });

    const id = uuidv4();
    let heading = mode === 'fixed_question' && questionText
      ? `[Fixed Question] ${questionText}`
      : prompt.slice(0, 80) + (prompt.length > 80 ? '...' : '');

    await pool.execute(
      'INSERT INTO responses (id, session_id, prompt, response, mode, heading) VALUES (?, ?, ?, ?, ?, ?)',
      [id, sessionId, prompt || questionText, responseText, mode || 'send', heading]
    );

    res.json({
      id,
      prompt: prompt || questionText,
      response: responseText,
      mode: mode || 'send',
      heading,
    });
  } catch (err) {
    console.error('Generate error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate response' });
  }
}

async function getResponses(req, res) {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM responses WHERE session_id = ? ORDER BY created_at ASC',
      [req.params.sessionId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get responses' });
  }
}

async function deleteResponse(req, res) {
  try {
    await pool.execute('DELETE FROM responses WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete response' });
  }
}

async function clearResponses(req, res) {
  try {
    await pool.execute('DELETE FROM responses WHERE session_id = ?', [req.params.sessionId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear responses' });
  }
}

async function getNotes(req, res) {
  try {
    const [rows] = await pool.execute('SELECT * FROM notes WHERE session_id = ?', [req.params.sessionId]);
    res.json(rows[0] || { content: '' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get notes' });
  }
}

async function saveNotes(req, res) {
  try {
    const { sessionId, content } = req.body;
    const [existing] = await pool.execute('SELECT id FROM notes WHERE session_id = ?', [sessionId]);

    if (existing.length) {
      await pool.execute('UPDATE notes SET content = ? WHERE session_id = ?', [content, sessionId]);
      res.json({ id: existing[0].id, content });
    } else {
      const id = uuidv4();
      await pool.execute('INSERT INTO notes (id, session_id, content) VALUES (?, ?, ?)', [id, sessionId, content]);
      res.json({ id, content });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to save notes' });
  }
}

async function getFixedQuestions(req, res) {
  try {
    const [rows] = await pool.execute('SELECT * FROM fixed_questions ORDER BY sort_order ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get fixed questions' });
  }
}

module.exports = {
  createSession,
  getSession,
  generateAndSave,
  getResponses,
  deleteResponse,
  clearResponses,
  getNotes,
  saveNotes,
  getFixedQuestions,
};
