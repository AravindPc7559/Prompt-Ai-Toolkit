import { openai, getModel } from '../config/openai.js';
import { REWRITE_PROMPT } from '../utils/prompts.js';
import { removePrefixes, REWRITE_PREFIXES } from '../utils/textCleaner.js';
import { logUsage, incrementFreeTrialUsage, checkAndUpdateSubscriptionExpiration } from '../services/usageService.js';

/**
 * Rewrite and improve a prompt using AI
 */
export const rewritePrompt = async (req, res, next) => {
  try {
    const { prompt, format } = req.body;
    const userId = req.user?.id;
    
    // Check and update subscription expiration before processing
    if (userId) {
      await checkAndUpdateSubscriptionExpiration(userId);
    }
    
    const model = getModel();
    
    const completion = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: 'system', content: REWRITE_PROMPT },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    let rewrittenPrompt = completion.choices[0].message.content;
    rewrittenPrompt = removePrefixes(rewrittenPrompt, REWRITE_PREFIXES);

    // Log usage to database and increment free trial if needed
    if (userId) {
      await logUsage(userId, 'rewrite', {
        inputLength: prompt.length,
        outputLength: rewrittenPrompt.length,
        model: model,
        tokensUsed: completion.usage?.total_tokens || 0,
        success: true
      });
      
      // Increment free trial usage if user is not subscribed
      if (!req.usageInfo?.isSubscribed) {
        await incrementFreeTrialUsage(userId);
      }
    }

    res.json({
      success: true,
      originalPrompt: prompt,
      rewrittenPrompt: rewrittenPrompt,
      format: format || 'default'
    });
  } catch (error) {
    // Log error to usage history
    if (req.user?.id) {
      await logUsage(req.user.id, 'rewrite', {
        inputLength: req.body.prompt?.length || 0,
        success: false,
        error: error.message
      });
    }
    next(error);
  }
};
