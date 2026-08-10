/* Data Access Object (DAO) module for accessing users data */

import db from './db.mjs';
import crypto from 'crypto';

// Returns user's information given its id (used by passport deserialize).
const getUserById = (id) => {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM users WHERE id=?';
    db.get(sql, [id], (err, row) => {
      if (err)
        reject(err);
      else if (row === undefined)
        resolve({ error: 'User not found.' });
      else {
        // The local strategy looks for "username": we map email to it for simplicity.
        const user = { id: row.id, username: row.email, name: row.name,
                       secret: row.secret, lastTotpStep: row.lastTotpStep, credit: row.credit };
        resolve(user);
      }
    });
  });
};

// Used at log-in time to verify username (email) and password.
const getUser = (email, password) => {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM users WHERE email=?';
    db.get(sql, [email], (err, row) => {
      if (err) {
        reject(err);
      } else if (row === undefined) {
        resolve(false);
      } else {
        const user = { id: row.id, username: row.email, name: row.name,
                       secret: row.secret, lastTotpStep: row.lastTotpStep, credit: row.credit };

        // Compare hashes with an async, CPU-intensive call so the server is not blocked.
        crypto.scrypt(password, row.salt, 32, function (err, hashedPassword) {
          if (err) reject(err);
          if (!crypto.timingSafeEqual(Buffer.from(row.hash, 'hex'), hashedPassword))
            resolve(false);
          else
            resolve(user);
        });
      }
    });
  });
};

// Reads the current credit of a user from the DB.
const getCredit = (userId) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT credit FROM users WHERE id=?', [userId], (err, row) => {
      if (err) reject(err);
      else if (row === undefined) resolve({ error: 'User not found.' });
      else resolve(row.credit);
    });
  });
};

// Adds (delta can be negative) an amount to the user's credit and returns the new value.
// ROUND(...,2) keeps the stored credit at 2 decimals, avoiding floating-point drift on money.
const updateCredit = (userId, delta) => {
  return new Promise((resolve, reject) => {
    const sql = 'UPDATE users SET credit = ROUND(credit + ?, 2) WHERE id = ?';
    db.run(sql, [delta, userId], function (err) {
      if (err) reject(err);
      else if (this.changes !== 1) resolve({ error: 'User not found.' });
      else getCredit(userId).then(resolve).catch(reject);
    });
  });
};

// Stores the last used TOTP time-step for replay protection.
const updateLastTotpStep = (userId, lastTotpStep) => {
  return new Promise((resolve, reject) => {
    const sql = 'UPDATE users SET lastTotpStep = ? WHERE id = ?';
    db.run(sql, [lastTotpStep, userId], function (err) {
      if (err) reject(err);
      else if (this.changes !== 1) resolve({ error: 'User not found.' });
      else resolve(this.changes);
    });
  });
};

export default { getUserById, getUser, getCredit, updateCredit, updateLastTotpStep };
