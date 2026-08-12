const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/interviewController');
const { generateResponse } = require('../services/aiService');

router.post('/chat', async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY?.trim()) {
      return res.status(500).json({
        error: 'OpenAI API key missing. Add OPENAI_API_KEY to backend/.env and restart the backend.',
      });
    }

    const { prompt, mode, questionText, previousResponse } = req.body;
    if (!prompt && !questionText) {
      return res.status(400).json({ error: 'prompt is required' });
    }
    const response = await generateResponse(prompt, mode || 'send', {
      questionText,
      previousResponse,
    });
    res.json({ response });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate response' });
  }
});

router.post('/sessions', ctrl.createSession);
router.get('/sessions/:id', ctrl.getSession);
router.post('/generate', ctrl.generateAndSave);
router.get('/responses/:sessionId', ctrl.getResponses);
router.delete('/responses/:id', ctrl.deleteResponse);
router.delete('/responses/session/:sessionId', ctrl.clearResponses);
router.get('/notes/:sessionId', ctrl.getNotes);
router.post('/notes', ctrl.saveNotes);
router.get('/fixed-questions', ctrl.getFixedQuestions);

module.exports = router;
