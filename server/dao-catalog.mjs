/* Data Access Object module for the (read-only) catalog */

import db from './db.mjs';

// Returns the sizes with prices, limits and CURRENT availability.
// Availability is always derived from confirmed orders, so it stays correct with many clients.
const getSizes = () => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT s.size, s.base_price, s.included_ingredients, s.max_dressings, s.daily_max,
             COALESCE((SELECT SUM(os.quantity) FROM order_sandwiches os WHERE os.size = s.size), 0) AS allocated
      FROM sizes s`;
    db.all(sql, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows.map(r => ({
        size: r.size,
        basePrice: r.base_price,
        includedIngredients: r.included_ingredients,
        maxDressings: r.max_dressings,
        dailyMax: r.daily_max,
        available: r.daily_max - r.allocated,
      })));
    });
  });
};

// Small helper to read a single-column catalog table into an array of strings.
const getNames = (table) => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT name FROM ${table}`, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows.map(r => r.name));
    });
  });
};

// Returns the whole menu of choices the user can pick from.
const getMenu = async () => {
  const [mains, breads, ingredients, dressings] = await Promise.all([
    getNames('main_ingredients'),
    getNames('breads'),
    getNames('ingredients'),
    getNames('dressings'),
  ]);
  return { mains, breads, ingredients, dressings };
};

export default { getSizes, getMenu };
