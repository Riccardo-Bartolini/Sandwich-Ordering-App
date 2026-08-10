/* Data Access Object (DAO) module for orders.
 * An order is a confirmed list of configured sandwiches belonging to one user. */

import db from './db.mjs';

/*** Small promise wrappers around the sqlite3 callback API ***/
const runAsync = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) {
    if (err) reject(err);
    else resolve({ lastID: this.lastID, changes: this.changes });
  });
});
const allAsync = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
});
const getAsync = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
});

// Loads the configured sandwiches (with ingredients and dressings) of a given order.
const loadSandwiches = async (orderId) => {
  const rows = await allAsync('SELECT * FROM order_sandwiches WHERE orderId=?', [orderId]);
  const sandwiches = [];
  for (const r of rows) {
    const ingredients = (await allAsync('SELECT ingredient FROM sandwich_ingredients WHERE sandwichId=?', [r.id]))
      .map(x => x.ingredient);
    const dressings = (await allAsync('SELECT dressing FROM sandwich_dressings WHERE sandwichId=?', [r.id]))
      .map(x => x.dressing);
    sandwiches.push({
      id: r.id,
      size: r.size,
      mainIngredient: r.main_ingredient,
      bread: r.bread,
      quantity: r.quantity,
      unitPrice: r.unit_price,
      ingredients,
      dressings,
    });
  }
  return sandwiches;
};

// Returns all confirmed orders of a user, with full details. Filtered by userId.
const listOrders = async (userId) => {
  const orders = await allAsync('SELECT * FROM orders WHERE userId=?', [userId]);
  const result = [];
  for (const o of orders)
    result.push({ id: o.id, total: o.total, sandwiches: await loadSandwiches(o.id) });
  return result;
};

// Returns a single order ONLY if it belongs to the given user, otherwise { error }.
const getOrder = async (userId, orderId) => {
  const o = await getAsync('SELECT * FROM orders WHERE id=? AND userId=?', [orderId, userId]);
  if (!o) return { error: 'Order not found.' };
  return { id: o.id, total: o.total, sandwiches: await loadSandwiches(o.id) };
};

// Returns the quantities already allocated per size across all confirmed orders.
// Used to check availability at confirmation time.
const getAllocatedBySize = async () => {
  const rows = await allAsync('SELECT size, SUM(quantity) AS allocated FROM order_sandwiches GROUP BY size', []);
  const allocated = {};
  for (const r of rows) allocated[r.size] = r.allocated;
  return allocated;
};

/* Creates a new confirmed order with all its sandwiches, ingredients and dressings.
 * The caller has ALREADY validated input, recomputed prices and checked availability/credit.
 * sandwiches: [{ size, mainIngredient, bread, quantity, unitPrice, ingredients:[], dressings:[] }] */
const createOrder = async (userId, sandwiches, total) => {
  const { lastID: orderId } = await runAsync('INSERT INTO orders (userId, total) VALUES (?,?)', [userId, total]);
  for (const s of sandwiches) {
    const { lastID: sandwichId } = await runAsync(
      'INSERT INTO order_sandwiches (orderId, size, main_ingredient, bread, quantity, unit_price) VALUES (?,?,?,?,?,?)',
      [orderId, s.size, s.mainIngredient, s.bread, s.quantity, s.unitPrice]);
    for (const ing of s.ingredients)
      await runAsync('INSERT INTO sandwich_ingredients (sandwichId, ingredient) VALUES (?,?)', [sandwichId, ing]);
    for (const dr of s.dressings)
      await runAsync('INSERT INTO sandwich_dressings (sandwichId, dressing) VALUES (?,?)', [sandwichId, dr]);
  }
  return getOrder(userId, orderId);
};

/* Deletes a confirmed order  ONLY if it belongs to the user.
 * Returns the number of deleted orders (0 if it did not belong to the user). */
const deleteOrder = async (userId, orderId) => {
  // Verify ownership first; if not owned, do nothing.
  const owned = await getAsync('SELECT id FROM orders WHERE id=? AND userId=?', [orderId, userId]);
  if (!owned) return 0;

  const sandwiches = await allAsync('SELECT id FROM order_sandwiches WHERE orderId=?', [orderId]);
  for (const s of sandwiches) {
    await runAsync('DELETE FROM sandwich_ingredients WHERE sandwichId=?', [s.id]);
    await runAsync('DELETE FROM sandwich_dressings WHERE sandwichId=?', [s.id]);
  }
  await runAsync('DELETE FROM order_sandwiches WHERE orderId=?', [orderId]);
  const { changes } = await runAsync('DELETE FROM orders WHERE id=? AND userId=?', [orderId, userId]);
  return changes;
};

export default { listOrders, getOrder, getAllocatedBySize, createOrder, deleteOrder };
