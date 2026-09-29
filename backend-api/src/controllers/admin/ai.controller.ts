import { Response } from 'express';
import { AdminRequest } from '../../middleware/adminAuth.middleware';
import { PURPOSES, generateContent, isAiConfigured } from '../../services/aiContent.service';
import { sendSuccess, sendError } from '../../utils/response';

export const generateAiContent = async (req: AdminRequest, res: Response): Promise<void> => {
  if (!isAiConfigured()) { sendError(res, 'AI writing is not set up. Add GROQ_CONTENT_API_KEY to the server.', 503); return; }

  const { purpose, context, currentText, countryId } = req.body || {};
  if (!PURPOSES[purpose]) { sendError(res, 'Unknown content field'); return; }

  try {
    const text = await generateContent({
      purpose,
      context: context && typeof context === 'object' ? context : {},
      currentText: typeof currentText === 'string' ? currentText : undefined,
      countryId: typeof countryId === 'string' && countryId ? countryId : undefined,
    });
    sendSuccess(res, { text });
  } catch (err: any) {
    console.error('[AI] Generation failed:', err?.status, err?.message);
    const status = err?.status === 429 ? 429 : err?.status === 400 ? 400 : 502;
    sendError(res, status === 429 ? 'The AI is busy right now. Please try again in a minute.' : err?.message || 'Could not generate content', status);
  }
};
