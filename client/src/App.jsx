/*
 * Web Applications - Exam #2 "Sandwich"
 */

import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './App.css';

import { useState, useEffect } from 'react';
import { Container } from 'react-bootstrap';
import { Routes, Route, Navigate, useNavigate } from 'react-router';

import {
  GenericLayout, NotFoundLayout, HomeLayout,
  ConfiguratorLayout, OrdersLayout, LoginLayout, TotpLayout,
} from './components/Layout';
import API from './API.js';

// Module-level counter for local cart-item keys (purely client-side, never stored in the DB).
let nextCartKey = 1;

function App() {
  const navigate = useNavigate();

  // Authentication state.
  const [loggedIn, setLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [loggedInTotp, setLoggedInTotp] = useState(false);

  // Catalog (public) and user's confirmed orders.
  const [sizes, setSizes] = useState([]);
  const [menu, setMenu] = useState({ mains: [], breads: [], ingredients: [], dressings: [] });
  const [orders, setOrders] = useState([]);

  // The order being configured (list of sandwiches). Lives here so "duplicate" can seed it.
  const [cart, setCart] = useState([]);

  // Feedback message shown to the user (errors and confirmations).
  const [message, setMessage] = useState('');

  // Turns any error into a readable message for the user.
  const handleErrors = (err) => {
    let msg = '';
    if (err.error) msg = err.error;
    else if (Array.isArray(err) && err.length && err[0].msg) msg = err[0].msg;
    else if (typeof err === 'string') msg = err;
    else msg = 'Unknown error';
    setMessage({ type: 'danger', text: msg });
  };

  const showSuccess = (text) => setMessage({ type: 'success', text });

  // Load the public catalog once at startup.
  useEffect(() => {
    API.getSizes().then(setSizes).catch(handleErrors);
    API.getMenu().then(setMenu).catch(handleErrors);
  }, []);

  // Check whether a session is already active (e.g. after a page reload).
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const u = await API.getUserInfo();
        setUser(u);
        setLoggedIn(true);
        if (u.isTotp) setLoggedInTotp(true);
      } catch {
        // Not authenticated yet: nothing to do.
      }
    };
    checkAuth();
  }, []);

  // Refresh the availability (used after operations and while configuring).
  const refreshSizes = () => API.getSizes().then(setSizes).catch(handleErrors);

  // Refresh the user's orders.
  const refreshOrders = () => API.getOrders().then(setOrders).catch(handleErrors);

  const handleLogin = async (credentials) => {
    // Errors are shown by the login form, so let them propagate.
    const u = await API.logIn(credentials);
    setUser(u);
    setLoggedIn(true);
  };

  const handleLogout = async () => {
    try {
      await API.logOut();
    } catch (err) {
      console.log(err);
    } finally {
      setLoggedIn(false);
      setLoggedInTotp(false);
      setUser(null);
      setOrders([]);
      setCart([]);
      setMessage('');
      navigate('/');
    }
  };

  // Confirm the current cart as a new order.
  const confirmOrder = async () => {
    try {
      const payload = cart.map(s => ({
        size: s.size, mainIngredient: s.mainIngredient, bread: s.bread,
        quantity: s.quantity, ingredients: s.ingredients, dressings: s.dressings,
      }));
      const res = await API.addOrder(payload);
      setUser(prev => ({ ...prev, credit: res.credit })); // update shown credit
      setCart([]);
      await refreshSizes();
      await refreshOrders();
      showSuccess('Order confirmed!');
      navigate('/orders');
    } catch (err) {
      handleErrors(err); // e.g. "Not enough L sandwiches available" / "Insufficient credit"
      // Another client may have changed availability meanwhile: show the up-to-date numbers
      // so the user can adjust the order (the cart is kept).
      refreshSizes();
    }
  };

  // Delete one of the user's confirmed orders (server requires 2FA).
  const removeOrder = async (orderId) => {
    try {
      const res = await API.deleteOrder(orderId);
      setUser(prev => ({ ...prev, credit: res.credit }));
      await refreshSizes();
      await refreshOrders();
      showSuccess(`Order deleted, € ${res.refund.toFixed(2)} refunded.`);
    } catch (err) {
      handleErrors(err);
    }
  };

  // Duplicate a confirmed order into the configurator as a new draft.
  const duplicateOrder = (order) => {
    const draft = order.sandwiches.map(s => ({
      key: nextCartKey++,
      size: s.size, mainIngredient: s.mainIngredient, bread: s.bread,
      quantity: s.quantity, ingredients: [...s.ingredients], dressings: [...s.dressings],
    }));
    setCart(draft);
    setMessage('');
    navigate('/configurator');
  };

  // Adds a configured sandwich to the cart, assigning a local key.
  const addToCart = (sandwich) => setCart(prev => [...prev, { ...sandwich, key: nextCartKey++ }]);
  const removeFromCart = (key) => setCart(prev => prev.filter(s => s.key !== key));
  const updateCartQuantity = (key, quantity) =>
    setCart(prev => prev.map(s => s.key === key ? { ...s, quantity } : s));
  // Replace the whole content of an existing cart line (used when editing a sandwich).
  const updateCartItem = (key, sandwich) =>
    setCart(prev => prev.map(s => s.key === key ? { ...sandwich, key } : s));

  return (
    <Container fluid className="px-0">
      <Routes>
        <Route path="/" element={<GenericLayout message={message} setMessage={setMessage}
          loggedIn={loggedIn} user={user} loggedInTotp={loggedInTotp} logout={handleLogout} />}>
          <Route index element={<HomeLayout sizes={sizes} menu={menu} loggedIn={loggedIn} />} />
          <Route path="configurator" element={loggedIn
            ? <ConfiguratorLayout sizes={sizes} menu={menu} cart={cart}
                addToCart={addToCart} removeFromCart={removeFromCart}
                updateCartQuantity={updateCartQuantity} updateCartItem={updateCartItem}
                refreshSizes={refreshSizes} confirmOrder={confirmOrder} />
            : <Navigate replace to="/" />} />
          <Route path="orders" element={loggedIn
            ? <OrdersLayout orders={orders} refreshOrders={refreshOrders}
                duplicateOrder={duplicateOrder} removeOrder={removeOrder}
                loggedInTotp={loggedInTotp} />
            : <Navigate replace to="/" />} />
          <Route path="*" element={<NotFoundLayout />} />
        </Route>
        <Route path="/login" element={<LoginWithTotp loggedIn={loggedIn} user={user}
          loggedInTotp={loggedInTotp} login={handleLogin}
          setLoggedIn={setLoggedIn} setLoggedInTotp={setLoggedInTotp} />} />
      </Routes>
    </Container>
  );
}

// Decides what to show on /login: the login form, the (optional) TOTP step, or a redirect.
function LoginWithTotp(props) {
  if (props.loggedIn) {
    if (props.user.canDoTotp && !props.loggedInTotp)
      return <TotpLayout totpSuccessful={() => props.setLoggedInTotp(true)} setLoggedIn={props.setLoggedIn} />;
    return <Navigate replace to="/" />;
  }
  return <LoginLayout login={props.login} />;
}

export default App;
