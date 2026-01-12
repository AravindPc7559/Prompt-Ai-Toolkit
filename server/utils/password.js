import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

/**
 * Hash a password
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
export const hashPassword = async (password) => {
  return await bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Compare a password with a hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} True if password matches
 */
export const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};
