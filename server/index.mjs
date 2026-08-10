
import express from 'express';
import morgan from 'morgan';                      
import { check, validationResult } from 'express-validator'; 
import cors from 'cors';


import passport from 'passport';                    
import LocalStrategy from 'passport-local';         
import session from 'express-session';              
import { TOTP } from 'otpauth';                      

import userDao from './dao-users.mjs';
import catalogDao from './dao-catalog.mjs';
import ordersDao from './dao-orders.mjs';


const app = express();
app.use(morgan('dev'));
app.use(express.json());


const corsOptions = {
  origin: 'http://localhost:5173',
  credentials: true,
};
app.use(cors(corsOptions));

/* Passport */

// Verify username (email) and password against the DB.
passport.use(new LocalStrategy(async function verify(username, password, callback) {
  const user = await userDao.getUser(username, password);
  if (!user)
    return callback(null, false, 'Incorrect username or password');
  return callback(null, user); // full user info kept in the (server-side) session
}));

// Only the user id is kept in the session; the fresh, full user is reloaded from the DB on
// every request. This keeps mutable data always up to date.
passport.serializeUser(function (user, callback) {
  callback(null, user.id);
});
passport.deserializeUser(function (id, callback) {
  userDao.getUserById(id)
    .then(user => callback(null, user.error ? false : user)) // available as req.user
    .catch(err => callback(err, null));
});

app.use(session({
  secret: "shhhhh... it's the sandwich shop secret!",
  resave: false,
  saveUninitialized: false,
}));
app.use(passport.authenticate('session'));

/* Authentication */

// Requires a logged-in user.
const isLoggedIn = (req, res, next) => {
  if (req.isAuthenticated())
    return next();
  return res.status(401).json({ error: 'Not authenticated' });
};

// Requires the current session to have completed the 2FA (TOTP) step.
const isTotp = (req, res, next) => {
  if (req.session.method === 'totp')
    return next();
  return res.status(401).json({ error: 'Missing TOTP authentication' });
};

// Validates a TOTP token for a user, with replay protection based on the last used step.
function verifyTotpToken(user, token) {
  const totp = new TOTP({ algorithm: 'SHA1', digits: 6, period: 30, secret: user.secret });
  const delta = totp.validate({ token, window: 1 });
  if (delta === null)
    return false; // invalid code

  const actualStep = totp.counter() + delta;
  if (actualStep <= user.lastTotpStep)
    return false; // reject replay or older step

  user.lastTotpStep = actualStep; // accept and remember the step
  return true;
}

// Builds the user info that is safe to send to the client.
function clientUserInfo(req) {
  const u = req.user;
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    credit: u.credit,
    canDoTotp: u.secret ? true : false,
    isTotp: req.session.method === 'totp',
  };
}

/* Utility functions */

const round2 = (n) => Math.round(n * 100) / 100;

// Formats express-validator errors as strings.
const errorFormatter = ({ location, msg, param }) => `${location}[${param}]: ${msg}`;

// Application-level mutex: serializes the read-modify-write operations on shared state
// (sandwich availability and user credit) so that two concurrent requests cannot interleave
// between the check and the write.
let mutex = Promise.resolve();
function runExclusive(task) {
  const result = mutex.then(() => task());
  mutex = result.then(() => undefined, () => undefined); // next task waits, regardless of outcome
  return result;
}

/* Catalog APIs (public) */

// GET /api/sizes : sizes with prices, limits and current availability.
app.get('/api/sizes', (req, res) => {
  catalogDao.getSizes()
    .then(sizes => res.json(sizes))
    .catch(() => res.status(500).json({ error: 'Database error' }));
});

// GET /api/menu : lists of main ingredients, breads, optional ingredients and dressings.
app.get('/api/menu', (req, res) => {
  catalogDao.getMenu()
    .then(menu => res.json(menu))
    .catch(() => res.status(500).json({ error: 'Database error' }));
});

/* Orders APIs */

// GET /api/orders : the confirmed orders of the authenticated user (with full details).
app.get('/api/orders', isLoggedIn, (req, res) => {
  ordersDao.listOrders(req.user.id)
    .then(orders => res.json(orders))
    .catch(() => res.status(500).json({ error: 'Database error' }));
});

// POST /api/orders : confirm a new order. The whole order is created atomically in one API.
app.post('/api/orders', isLoggedIn,
  [ check('sandwiches').isArray({ min: 1 }) ],
  async (req, res) => {
    const errors = validationResult(req).formatWith(errorFormatter);
    if (!errors.isEmpty())
      return res.status(422).json(errors.errors);

    try {
      // Load the catalog from the DB: the server validates and prices everything itself,
      // never trusting values computed/sent by the client.
      const sizes = await catalogDao.getSizes();
      const menu = await catalogDao.getMenu();
      const sizeMap = Object.fromEntries(sizes.map(s => [s.size, s]));

      const validated = [];      // sandwiches with server-computed unit price
      const unitsBySize = {};    // requested units per size, for availability check

      for (const s of req.body.sandwiches) {
        if (!s || typeof s !== 'object')
          return res.status(422).json({ error: 'Invalid sandwich' });

        // Quantity must be a positive integer (sandwiches cannot be split).
        if (!Number.isInteger(s.quantity) || s.quantity < 1)
          return res.status(422).json({ error: 'Invalid quantity' });

        // Size, main ingredient and bread must exist in the catalog.
        // Look up with hasOwn so that keys inherited from Object.prototype  cannot masquerade as a valid size.
         
        const sizeInfo = Object.hasOwn(sizeMap, s.size) ? sizeMap[s.size] : undefined;
        if (!sizeInfo)
          return res.status(422).json({ error: 'Invalid size' });
        if (!menu.mains.includes(s.mainIngredient))
          return res.status(422).json({ error: 'Invalid main ingredient' });
        if (!menu.breads.includes(s.bread))
          return res.status(422).json({ error: 'Invalid bread' });

        // Optional ingredients: array of unique, known values.
        const ingredients = s.ingredients ?? [];
        if (!Array.isArray(ingredients) || new Set(ingredients).size !== ingredients.length)
          return res.status(422).json({ error: 'Invalid ingredients' });
        if (ingredients.some(i => !menu.ingredients.includes(i)))
          return res.status(422).json({ error: 'Unknown ingredient' });

        // Dressings: array of unique, known values, within the size limit.
        const dressings = s.dressings ?? [];
        if (!Array.isArray(dressings) || new Set(dressings).size !== dressings.length)
          return res.status(422).json({ error: 'Invalid dressings' });
        if (dressings.some(d => !menu.dressings.includes(d)))
          return res.status(422).json({ error: 'Unknown dressing' });
        if (dressings.length > sizeInfo.maxDressings)
          return res.status(422).json({ error: `Too many dressings for size ${s.size}` });

        // Unit price: each ingredient beyond the included count adds 30% of the base price.
        const extra = Math.max(0, ingredients.length - sizeInfo.includedIngredients);
        const unitPrice = round2(sizeInfo.basePrice * (1 + 0.30 * extra));

        validated.push({
          size: s.size, mainIngredient: s.mainIngredient, bread: s.bread,
          quantity: s.quantity, unitPrice, ingredients, dressings,
        });
        unitsBySize[s.size] = (unitsBySize[s.size] || 0) + s.quantity;
      }

      // Total price, with a 20% discount when the order has 4 or more sandwiches.
      let total = 0, totalUnits = 0;
      for (const v of validated) { total += v.unitPrice * v.quantity; totalUnits += v.quantity; }
      if (totalUnits >= 4) total *= 0.80;
      total = round2(total);

      // The availability/credit check and the write must be atomic across concurrent requests,
      // so they run inside the mutex (prevents over-booking and credit overdraw).
      const result = await runExclusive(async () => {
        // Availability check: for each size, requested units must fit the remaining daily limit.
        const allocated = await ordersDao.getAllocatedBySize();
        for (const sz of Object.keys(unitsBySize)) {
          const used = allocated[sz] || 0;
          if (used + unitsBySize[sz] > sizeMap[sz].dailyMax)
            return { status: 409, body: { error: `Not enough ${sz} sandwiches available` } };
        }
        // Credit check (authoritative value read from the DB).
        const credit = await userDao.getCredit(req.user.id);
        if (credit < total)
          return { status: 422, body: { error: 'Insufficient credit' } };
        // All constraints satisfied: create the order and charge the user.
        const order = await ordersDao.createOrder(req.user.id, validated, total);
        const newCredit = await userDao.updateCredit(req.user.id, -total);
        return { status: 200, body: { order, credit: newCredit } };
      });
      return res.status(result.status).json(result.body);
    } catch (err) {
      console.log(err);
      res.status(500).json({ error: 'Database error' });
    }
  }
);

// DELETE /api/orders/:id : delete one of the user's own orders. Requires 2FA (TOTP).
// Restores availability (it is derived) and refunds 90% of the paid amount.
app.delete('/api/orders/:id', isLoggedIn, isTotp,
  [ check('id').isInt({ min: 1 }) ],
  async (req, res) => {
    const errors = validationResult(req).formatWith(errorFormatter);
    if (!errors.isEmpty())
      return res.status(422).json(errors.errors);

    try {
      const orderId = Number(req.params.id);
      // Runs inside the mutex: reading the order, deleting it and refunding the credit must be
      // atomic with respect to concurrent order operations (ownership is enforced by getOrder).
      const result = await runExclusive(async () => {
        const order = await ordersDao.getOrder(req.user.id, orderId);
        if (order.error)
          return { status: 404, body: order };
        const changes = await ordersDao.deleteOrder(req.user.id, orderId);
        if (changes === 0)
          return { status: 404, body: { error: 'Order not found.' } };
        // Refund 90% of the paid amount.
        const refund = round2(order.total * 0.90);
        const newCredit = await userDao.updateCredit(req.user.id, refund);
        return { status: 200, body: { orderId, refund, credit: newCredit } };
      });
      return res.status(result.status).json(result.body);
    } catch (err) {
      console.log(err);
      res.status(500).json({ error: 'Database error' });
    }
  }
);

/* Users / session APIs */

// POST /api/sessions : login with username and password.
app.post('/api/sessions', function (req, res, next) {
  passport.authenticate('local', (err, user, info) => {
    if (err)
      return next(err);
    if (!user) {
      // info may be a string or an object: normalize to a string.
      const message = typeof info === 'string' ? info : (info && info.message) || 'Incorrect username or password';
      return res.status(401).json({ error: message });
    }
    req.login(user, (err) => {
      if (err)
        return next(err);
      return res.json(clientUserInfo(req));
    });
  })(req, res, next);
});

// POST /api/login-totp : verify the TOTP code and mark the session as 2FA-authenticated.
app.post('/api/login-totp', isLoggedIn,
  [ check('code').isLength({ min: 6, max: 6 }).isNumeric() ],
  async (req, res) => {
    const errors = validationResult(req).formatWith(errorFormatter);
    if (!errors.isEmpty())
      return res.status(422).json(errors.errors);

    if (!req.user.secret)
      return res.status(400).json({ error: 'Cannot authenticate with TOTP' });

    if (verifyTotpToken(req.user, req.body.code)) {
      req.session.method = 'totp';
      try {
        await userDao.updateLastTotpStep(req.user.id, req.user.lastTotpStep);
      } catch (err) {
        console.log(err);
        return res.status(500).json({ error: 'Database error' });
      }
      return res.json({ otp: 'authorized' });
    }
    return res.status(401).json({ error: 'Invalid or replayed TOTP code' });
  }
);

// GET /api/sessions/current : check whether the user is logged in.
app.get('/api/sessions/current', (req, res) => {
  if (req.isAuthenticated())
    res.status(200).json(clientUserInfo(req));
  else
    res.status(401).json({ error: 'Not authenticated' });
});

// DELETE /api/sessions/current : logout.
app.delete('/api/sessions/current', (req, res) => {
  req.logout(() => {
    res.status(200).json({});
  });
});

/* Centralized error handler: always answer with JSON, never leak stack traces to the client */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed')
    return res.status(400).json({ error: 'Invalid JSON body' });
  if (err.type === 'entity.too.large')
    return res.status(413).json({ error: 'Request body too large' });
  console.log(err); // log server-side for debugging; never send the stack to the client
  res.status(500).json({ error: 'Unexpected server error' });
});

/* Activating the server */
const PORT = 3001;
app.listen(PORT, (err) => {
  if (err)
    console.log(err);
  else
    console.log(`Server listening at http://localhost:${PORT}`);
});
