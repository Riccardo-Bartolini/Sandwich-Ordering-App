

import sqlite from 'sqlite3';

const db = new sqlite.Database('sandwich.db', (err) => {
  if (err) throw err;
});

export default db;
