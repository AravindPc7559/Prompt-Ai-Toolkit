/**
 * Contact controller for handling contact form submissions
 */
import { Contact } from '../models/Contact.js';
import { User } from '../models/User.js';

/**
 * Submit a contact form
 */
export const submitContact = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { subject, message } = req.body;

    // Validate input
    if (!subject || !subject.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Subject is required'
      });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    // Get user details
    const user = await User.findById(userId).select('name email');
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Create contact record
    const contact = new Contact({
      userId: user._id,
      name: user.name,
      email: user.email,
      subject: subject.trim(),
      message: message.trim(),
      status: 'new'
    });

    await contact.save();

    res.json({
      success: true,
      message: 'Your message has been submitted successfully. We will get back to you soon.',
      contactId: contact._id.toString()
    });
  } catch (error) {
    console.error('Error submitting contact form:', error);
    next(error);
  }
};

/**
 * Get user's contact submissions
 */
export const getUserContacts = async (req, res, next) => {
  try {
    const userId = req.user?.id;

    const contacts = await Contact.find({ userId })
      .sort({ createdAt: -1 })
      .select('subject message status createdAt updatedAt')
      .lean();

    res.json({
      success: true,
      contacts: contacts
    });
  } catch (error) {
    console.error('Error fetching user contacts:', error);
    next(error);
  }
};
