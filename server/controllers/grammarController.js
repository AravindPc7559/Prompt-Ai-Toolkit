import { openai, getModel } from '../config/openai.js';
import { GRAMMAR_PROMPT } from '../utils/prompts.js';
import { removePrefixes, GRAMMAR_PREFIXES } from '../utils/textCleaner.js';
import { logUsage, incrementFreeTrialUsage, checkAndUpdateSubscriptionExpiration } from '../services/usageService.js';

/**
 * Grammarize and correct text using AI
 */
export const grammarizeText = async (req, res, next) => {
  try {
    const { text } = req.body;
    const userId = req.user?.id;
    
    // Check and update subscription expiration before processing
    if (userId) {
      await checkAndUpdateSubscriptionExpiration(userId);
    }
    
    const model = getModel();
    
    const completion = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: 'system', content: GRAMMAR_PROMPT },
        { role: 'user', content: text }
      ],
      temperature: 0.3,
      max_tokens: 2000
    });

    let grammarizedText = completion.choices[0].message.content;
    grammarizedText = removePrefixes(grammarizedText, GRAMMAR_PREFIXES);

    // Log usage to database and increment free trial if needed
    if (userId) {
      await logUsage(userId, 'grammarize', {
        inputLength: text.length,
        outputLength: grammarizedText.length,
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
      originalText: text,
      grammarizedText: grammarizedText
    });
  } catch (error) {
    // Log error to usage history
    if (req.user?.id) {
      await logUsage(req.user.id, 'grammarize', {
        inputLength: req.body.text?.length || 0,
        success: false,
        error: error.message
      });
    }
    next(error);
  }
};
