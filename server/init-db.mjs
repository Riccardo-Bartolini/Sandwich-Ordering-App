

import sqlite from 'sqlite3';
import crypto from 'crypto';
import fs from 'fs';

const DB_FILE = 'sandwich.db';


if (fs.existsSync(DB_FILE))
  fs.unlinkSync(DB_FILE);

const db = new sqlite.Database(DB_FILE, (err) => { if (err) throw err; });


const TOTP_SECRET = 'LXBSMDTMSP2I5XFXIYRGFVWSFI';
const PASSWORD = 'pwd';   // same simple password for every user (each with its own salt)
const START_CREDIT = 100; // everyone conceptually starts at 100 euro

/*** Catalog definition ***/
const SIZES = [
  // size, base price, ingredients included in the base price, max dressings, daily limit
  { size: 'S', basePrice: 5,  included: 2, maxDressings: 1, dailyMax: 10 },
  { size: 'M', basePrice: 7,  included: 3, maxDressings: 2, dailyMax: 8 },
  { size: 'L', basePrice: 10, included: 4, maxDressings: 2, dailyMax: 6 },
];
const MAINS = ['roast beef', 'ham', 'bacon'];
const BREADS = ['wheat', 'brown'];
const INGREDIENTS = ['lettuce', 'olives', 'onions', 'cucumber', 'yellow cheese', 'tomatoes', 'mozzarella'];
const DRESSINGS = ['olive oil', 'mustard', 'mayonnaise'];

/*** Price helpers ***/
const sizeInfo = Object.fromEntries(SIZES.map(s => [s.size, s]));

// Unit price of one configured sandwich: each ingredient beyond the included count costs +30% of base.
function unitPrice(size, ingredients) {
  const info = sizeInfo[size];
  const extra = Math.max(0, ingredients.length - info.included);
  return info.basePrice * (1 + 0.30 * extra);
}

// Order total: sum of unit prices times quantity, with a 20% discount if total units >= 4.
function orderTotal(sandwiches) {
  let total = 0, units = 0;
  for (const s of sandwiches) {
    total += unitPrice(s.size, s.ingredients) * s.quantity;
    units += s.quantity;
  }
  if (units >= 4) total *= 0.80;
  return Math.round(total * 100) / 100; // keep 2 decimals
}

/*** Users (passwords hashed below) ***/
const users = [
  { email: 'u1@p.it', name: 'John' },
  { email: 'u2@p.it', name: 'Alice' },
  { email: 'u3@p.it', name: 'George' },
  { email: 'u4@p.it', name: 'Mary' },
];

/*** Preloaded confirmed orders (by user email).
 * Each sandwich: { size, main, bread, ingredients:[...], dressings:[...], quantity }.
 * Availability and credit at startup reflect these orders. ***/
const preloadedOrders = [
  // --- John (u1): 3 orders, one with mixed sizes ---
  { email: 'u1@p.it', sandwiches: [
    { size: 'S', main: 'ham',       bread: 'wheat', ingredients: ['lettuce', 'olives'],                          dressings: ['olive oil'], quantity: 1 },
    { size: 'M', main: 'roast beef',bread: 'brown', ingredients: ['lettuce', 'tomatoes', 'mozzarella'],          dressings: ['mustard'],   quantity: 1 },
    { size: 'L', main: 'bacon',     bread: 'wheat', ingredients: ['lettuce', 'olives', 'onions', 'cucumber'],    dressings: ['mayonnaise', 'olive oil'], quantity: 1 },
  ]},
  { email: 'u1@p.it', sandwiches: [
    { size: 'S', main: 'bacon',     bread: 'brown', ingredients: ['olives', 'tomatoes'],                         dressings: [],            quantity: 2 },
  ]},
  { email: 'u1@p.it', sandwiches: [
    { size: 'M', main: 'ham',       bread: 'wheat', ingredients: ['lettuce', 'olives', 'tomatoes', 'onions'],    dressings: ['mustard', 'mayonnaise'], quantity: 1 },
  ]},

  // --- Alice (u2): 3 orders, one with multiple units of the same sandwich ---
  { email: 'u2@p.it', sandwiches: [
    { size: 'S', main: 'roast beef',bread: 'wheat', ingredients: ['lettuce', 'cucumber'],                        dressings: ['olive oil'], quantity: 4 },
  ]},
  { email: 'u2@p.it', sandwiches: [
    { size: 'L', main: 'bacon',     bread: 'brown', ingredients: ['lettuce', 'olives', 'onions', 'cucumber', 'tomatoes', 'mozzarella'], dressings: ['mayonnaise', 'mustard'], quantity: 1 },
  ]},
  { email: 'u2@p.it', sandwiches: [
    { size: 'M', main: 'ham',       bread: 'brown', ingredients: ['lettuce', 'tomatoes', 'mozzarella'],          dressings: ['olive oil'], quantity: 2 },
  ]},
];

/*** Insertion ***/
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 32).toString('hex');
  return { salt, hash };
}

db.serialize(() => {
  
  db.run(`CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    secret TEXT,
    lastTotpStep INTEGER,
    credit REAL NOT NULL
  )`);

  db.run(`CREATE TABLE sizes (
    size TEXT PRIMARY KEY,
    base_price REAL NOT NULL,
    included_ingredients INTEGER NOT NULL,
    max_dressings INTEGER NOT NULL,
    daily_max INTEGER NOT NULL
  )`);

  db.run(`CREATE TABLE main_ingredients ( name TEXT PRIMARY KEY )`);
  db.run(`CREATE TABLE breads ( name TEXT PRIMARY KEY )`);
  db.run(`CREATE TABLE ingredients ( name TEXT PRIMARY KEY )`);
  db.run(`CREATE TABLE dressings ( name TEXT PRIMARY KEY )`);

  db.run(`CREATE TABLE orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    total REAL NOT NULL,
    FOREIGN KEY(userId) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE order_sandwiches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orderId INTEGER NOT NULL,
    size TEXT NOT NULL,
    main_ingredient TEXT NOT NULL,
    bread TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    FOREIGN KEY(orderId) REFERENCES orders(id)
  )`);

  db.run(`CREATE TABLE sandwich_ingredients (
    sandwichId INTEGER NOT NULL,
    ingredient TEXT NOT NULL,
    PRIMARY KEY(sandwichId, ingredient),
    FOREIGN KEY(sandwichId) REFERENCES order_sandwiches(id)
  )`);

  db.run(`CREATE TABLE sandwich_dressings (
    sandwichId INTEGER NOT NULL,
    dressing TEXT NOT NULL,
    PRIMARY KEY(sandwichId, dressing),
    FOREIGN KEY(sandwichId) REFERENCES order_sandwiches(id)
  )`);

  // Catalog rows
  for (const s of SIZES)
    db.run('INSERT INTO sizes VALUES (?,?,?,?,?)', [s.size, s.basePrice, s.included, s.maxDressings, s.dailyMax]);
  for (const m of MAINS) db.run('INSERT INTO main_ingredients VALUES (?)', [m]);
  for (const b of BREADS) db.run('INSERT INTO breads VALUES (?)', [b]);
  for (const i of INGREDIENTS) db.run('INSERT INTO ingredients VALUES (?)', [i]);
  for (const d of DRESSINGS) db.run('INSERT INTO dressings VALUES (?)', [d]);

  // Compute how much each user spends, to set the starting credit accordingly.
  const spentByEmail = {};
  for (const o of preloadedOrders)
    spentByEmail[o.email] = (spentByEmail[o.email] || 0) + orderTotal(o.sandwiches);

  // Users
  const userIdByEmail = {};
  let nextUserId = 1;
  for (const u of users) {
    const { salt, hash } = hashPassword(PASSWORD);
    const credit = Math.round((START_CREDIT - (spentByEmail[u.email] || 0)) * 100) / 100;
    const id = nextUserId++;
    userIdByEmail[u.email] = id;
    db.run('INSERT INTO users (id, email, name, hash, salt, secret, lastTotpStep, credit) VALUES (?,?,?,?,?,?,?,?)',
      [id, u.email, u.name, hash, salt, TOTP_SECRET, 0, credit]);
  }

  // Orders + sandwiches + ingredients/dressings
  let nextOrderId = 1;
  let nextSandwichId = 1;
  for (const o of preloadedOrders) {
    const orderId = nextOrderId++;
    const total = orderTotal(o.sandwiches);
    db.run('INSERT INTO orders (id, userId, total) VALUES (?,?,?)', [orderId, userIdByEmail[o.email], total]);
    for (const s of o.sandwiches) {
      const sId = nextSandwichId++;
      const price = Math.round(unitPrice(s.size, s.ingredients) * 100) / 100;
      db.run('INSERT INTO order_sandwiches (id, orderId, size, main_ingredient, bread, quantity, unit_price) VALUES (?,?,?,?,?,?,?)',
        [sId, orderId, s.size, s.main, s.bread, s.quantity, price]);
      for (const ing of s.ingredients)
        db.run('INSERT INTO sandwich_ingredients (sandwichId, ingredient) VALUES (?,?)', [sId, ing]);
      for (const dr of s.dressings)
        db.run('INSERT INTO sandwich_dressings (sandwichId, dressing) VALUES (?,?)', [sId, dr]);
    }
  }
});

db.close((err) => {
  if (err) throw err;
  console.log(`Database ${DB_FILE} created and seeded.`);
});
