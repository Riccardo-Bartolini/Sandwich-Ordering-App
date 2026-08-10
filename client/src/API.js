const SERVER_URL = 'http://localhost:3001/api/';

/**
 * Utility to parse the HTTP response. The server always returns JSON;
 * on error the format is { error: <message> }.
 */
function getJson(httpResponsePromise) {
  return new Promise((resolve, reject) => {
    httpResponsePromise
      .then((response) => {
        if (response.ok) {
          response.json()
            .then(json => resolve(json))
            .catch(() => reject({ error: 'Cannot parse server response' }));
        } else {
          response.json()
            .then(obj => reject(obj))               // error message in the body
            .catch(() => reject({ error: 'Cannot parse server response' }));
        }
      })
      .catch(() => reject({ error: 'Cannot communicate with the server' })); // connection error
  });
}

/* Catalog (public) */

// Sizes with prices, limits and current availability.
const getSizes = async () => {
  return getJson(fetch(SERVER_URL + 'sizes'));
};

// Menu: main ingredients, breads, optional ingredients and dressings.
const getMenu = async () => {
  return getJson(fetch(SERVER_URL + 'menu'));
};

/* Orders (authenticated) */

// The confirmed orders of the current user, with full details.
const getOrders = async () => {
  return getJson(fetch(SERVER_URL + 'orders', { credentials: 'include' }));
};

// Confirm a new order.
const addOrder = async (sandwiches) => {
  return getJson(fetch(SERVER_URL + 'orders', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sandwiches }),
  }));
};

// Delete one of the user's orders (requires a 2FA-authenticated session).
const deleteOrder = async (orderId) => {
  return getJson(fetch(SERVER_URL + 'orders/' + orderId, {
    method: 'DELETE',
    credentials: 'include',
  }));
};

/* Authentication */

const logIn = async (credentials) => {
  return getJson(fetch(SERVER_URL + 'sessions', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  }));
};

const getUserInfo = async () => {
  return getJson(fetch(SERVER_URL + 'sessions/current', { credentials: 'include' }));
};

const logOut = async () => {
  return getJson(fetch(SERVER_URL + 'sessions/current', {
    method: 'DELETE',
    credentials: 'include',
  }));
};

// Second factor: verify the TOTP code on the current session.
const totpVerify = async (code) => {
  return getJson(fetch(SERVER_URL + 'login-totp', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  }));
};

const API = { getSizes, getMenu, getOrders, addOrder, deleteOrder, logIn, getUserInfo, logOut, totpVerify };
export default API;
