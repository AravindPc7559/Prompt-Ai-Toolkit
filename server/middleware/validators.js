/**
 * Validation middleware functions
 */

export const validateRewriteRequest = (req, res, next) => {
  const { prompt } = req.body;
  
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ error: 'Prompt is required and must be a non-empty string' });
  }
  
  next();
};

export const validateTextRequest = (req, res, next) => {
  const { text } = req.body;
  
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'Text is required and must be a non-empty string' });
  }
  
  next();
};

export const validateTokenRequest = (req, res, next) => {
  const { token } = req.body;
  
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return res.status(400).json({ error: 'Token is required and must be a non-empty string' });
  }
  
  next();
};

export const validateRegisterRequest = (req, res, next) => {
  const { email, name, password } = req.body;
  
  if (!email || typeof email !== 'string' || email.trim().length === 0) {
    return res.status(400).json({ error: 'Email is required and must be a non-empty string' });
  }
  
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Name is required and must be a non-empty string' });
  }
  
  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'Password is required and must be at least 6 characters' });
  }
  
  // Basic email validation
  const emailRegex = /^\S+@\S+\.\S+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Please provide a valid email address' });
  }
  
  next();
};

export const validateLoginRequest = (req, res, next) => {
  const { email, password } = req.body;
  
  if (!email || typeof email !== 'string' || email.trim().length === 0) {
    return res.status(400).json({ error: 'Email is required and must be a non-empty string' });
  }
  
  if (!password || typeof password !== 'string' || password.length === 0) {
    return res.status(400).json({ error: 'Password is required' });
  }
  
  next();
};

export const validateApiKey = (req, res, next) => {
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OpenAI API key is not configured' });
  }
  
  next();
};

/**
 * Validate payment order creation request
 */
export const validatePaymentOrder = (req, res, next) => {
  const { amount, currency = 'INR', plan = 'monthly' } = req.body;
  
  // Validate amount
  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Amount is required and must be a positive number'
    });
  }
  
  // Validate amount range (₹1 to ₹10,000)
  const MIN_AMOUNT = 1;
  const MAX_AMOUNT = 10000;
  if (amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
    return res.status(400).json({
      success: false,
      error: `Amount must be between ₹${MIN_AMOUNT} and ₹${MAX_AMOUNT}`
    });
  }
  
  // Validate currency
  if (currency && currency.toUpperCase() !== 'INR') {
    return res.status(400).json({
      success: false,
      error: 'Only INR currency is supported'
    });
  }
  
  // Validate plan
  if (plan && !['monthly'].includes(plan)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid plan'
    });
  }
  
  // Validate amount matches plan pricing
  const PRICING = {
    monthly: 130
  };
  
  if (amount !== PRICING[plan]) {
    return res.status(400).json({
      success: false,
      error: `Amount does not match plan pricing. Expected ₹${PRICING[plan]} for ${plan} plan`
    });
  }
  
  next();
};

/**
 * Validate payment verification request
 */
export const validatePaymentVerification = (req, res, next) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  
  if (!razorpay_order_id || typeof razorpay_order_id !== 'string' || razorpay_order_id.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Order ID is required'
    });
  }
  
  // Validate order ID format (Razorpay format: order_xxxxx)
  if (!razorpay_order_id.match(/^order_[a-zA-Z0-9]+$/)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid order ID format'
    });
  }
  
  if (!razorpay_payment_id || typeof razorpay_payment_id !== 'string' || razorpay_payment_id.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Payment ID is required'
    });
  }
  
  // Validate payment ID format (Razorpay format: pay_xxxxx)
  if (!razorpay_payment_id.match(/^pay_[a-zA-Z0-9]+$/)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid payment ID format'
    });
  }
  
  if (!razorpay_signature || typeof razorpay_signature !== 'string' || razorpay_signature.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Payment signature is required'
    });
  }
  
  // Validate signature format (should be 64 character hex string)
  if (!razorpay_signature.match(/^[a-f0-9]{64}$/i)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid signature format'
    });
  }
  
  next();
};
