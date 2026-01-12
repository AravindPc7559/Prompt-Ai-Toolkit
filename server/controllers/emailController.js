import { openai, getModel } from '../config/openai.js';
import { EMAIL_FORMAT_PROMPT } from '../utils/prompts.js';
import { removePrefixes, EMAIL_PREFIXES } from '../utils/textCleaner.js';
import { logUsage, incrementFreeTrialUsage, checkAndUpdateSubscriptionExpiration } from '../services/usageService.js';

/**
 * Format content into a professional email using AI
 */
export const formatEmail = async (req, res, next) => {
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
        { role: 'system', content: EMAIL_FORMAT_PROMPT },
        { role: 'user', content: text }
      ],
      temperature: 0.3,
      max_tokens: 2000
    });

    let formattedEmail = completion.choices[0].message.content;
    formattedEmail = removePrefixes(formattedEmail, EMAIL_PREFIXES);

    // Log usage to database and increment free trial if needed
    if (userId) {
      await logUsage(userId, 'format-email', {
        inputLength: text.length,
        outputLength: formattedEmail.length,
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
      formattedEmail: formattedEmail
    });
  } catch (error) {
    // Log error to usage history
    if (req.user?.id) {
      await logUsage(req.user.id, 'format-email', {
        inputLength: req.body.text?.length || 0,
        success: false,
        error: error.message
      });
    }
    next(error);
  }
};
