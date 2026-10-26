/**
 * Milo Document Security & Encryption Module
 * Implements AES-256-GCM encryption for documents and Aadhaar masking
 * PDF Page 11, 12
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// 256-bit encryption key (In production loaded from secure KMS / env)
const ENCRYPTION_KEY = process.env.DOC_ENCRYPTION_KEY || crypto.scryptSync('milo-secret-salt-key-2026', 'milo-salt', 32);
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

/**
 * Encrypt a buffer or string
 * @param {Buffer|string} bufferOrString 
 * @returns {Buffer} Encrypted binary (IV + AuthTag + Ciphertext)
 */
function encryptBuffer(bufferOrString) {
  const buffer = Buffer.isBuffer(bufferOrString) ? bufferOrString : Buffer.from(bufferOrString);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  
  const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  
  // Pack: IV (16 bytes) + Tag (16 bytes) + Ciphertext
  return Buffer.concat([iv, tag, ciphertext]);
}

/**
 * Decrypt encrypted payload
 * @param {Buffer} encryptedBuffer 
 * @returns {Buffer} Original plaintext buffer
 */
function decryptBuffer(encryptedBuffer) {
  const iv = encryptedBuffer.subarray(0, IV_LENGTH);
  const tag = encryptedBuffer.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = encryptedBuffer.subarray(IV_LENGTH + TAG_LENGTH);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(tag);
  
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Mask an Aadhaar number to only show the last 4 digits
 * e.g., "1234 5678 9012" -> "•••• •••• 9012"
 * e.g., "123456789012" -> "••••••••9012"
 */
function maskAadhaar(aadhaarStr) {
  if (!aadhaarStr) return '';
  const clean = String(aadhaarStr).replace(/\s+/g, '');
  if (clean.length < 4) return '••••';
  const last4 = clean.slice(-4);
  return `•••• •••• ${last4}`;
}

/**
 * Validate allowed document types: jpeg, png, webp, pdf
 */
function isAllowedDocType(filenameOrMime) {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
  const ext = path.extname(filenameOrMime).toLowerCase();
  return allowed.includes(ext) || /^(image\/(jpeg|png|webp)|application\/pdf)$/i.test(filenameOrMime);
}

module.exports = {
  encryptBuffer,
  decryptBuffer,
  maskAadhaar,
  isAllowedDocType
};
