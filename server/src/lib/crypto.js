import crypto from 'node:crypto';
import argon2 from 'argon2';
export const hashSecret = (value) => crypto.createHash('sha256').update(value).digest('hex');
export const randomToken = () => crypto.randomBytes(32).toString('hex');
export const hashPassword = (password) => argon2.hash(password, { type: argon2.argon2id });
export const verifyPassword = (hash, password) => argon2.verify(hash, password);
