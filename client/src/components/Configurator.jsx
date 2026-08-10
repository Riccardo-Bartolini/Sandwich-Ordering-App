import { useState, useEffect } from 'react';
import { Row, Col, Card, Form, Button, Table, Alert, Badge } from 'react-bootstrap';
import { unitPrice, orderSubtotal, orderDiscount, orderTotal, totalUnits, unitsOfSizeInCart, euro, SIZE_LABELS } from '../pricing.js';

function Configurator(props) {
  const { sizes, menu, cart, addToCart, removeFromCart, updateCartQuantity, updateCartItem, refreshSizes, confirmOrder } = props;

  // Form state for the sandwich currently being configured.
  const [size, setSize] = useState('S');
  const [mainIngredient, setMainIngredient] = useState('');
  const [bread, setBread] = useState('');
  const [ingredients, setIngredients] = useState([]);
  const [dressings, setDressings] = useState([]);
  const [quantity, setQuantity] = useState('1');
  const [formError, setFormError] = useState('');
  // Key of the cart line currently being edited (null when adding a new sandwich).
  const [editingKey, setEditingKey] = useState(null);
  // True while the order confirmation is in flight (disables the button to avoid double submit).
  const [confirming, setConfirming] = useState(false);

  // Set defaults for main ingredient and bread once the menu is available.
  useEffect(() => { if (menu.mains.length && !mainIngredient) setMainIngredient(menu.mains[0]); }, [menu.mains, mainIngredient]);
  useEffect(() => { if (menu.breads.length && !bread) setBread(menu.breads[0]); }, [menu.breads, bread]);

  // Refresh availability when opening the configurator.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { refreshSizes(); }, []);

  const sizeInfo = sizes.find(s => s.size === size);
  const maxDressings = sizeInfo ? sizeInfo.maxDressings : 0;
  // Units of this size still bookable now (current availability minus what is already in the cart).
  // The line being edited is excluded, since it is going to be replaced.
  const remaining = sizeInfo ? sizeInfo.available - unitsOfSizeInCart(cart, size, editingKey) : 0;
  // When the selected size has no units left, the whole configuration is disabled.
  // The size selector stays active, so the user can switch to an available size.
  const outOfStock = remaining <= 0;
  const previewPrice = sizeInfo ? unitPrice(size, ingredients.length, sizes) : 0;
  const extraIngredients = sizeInfo ? Math.max(0, ingredients.length - sizeInfo.includedIngredients) : 0;
  // Preview of the sandwich line being configured: subtotal, discount (if qty >= 4) and total.
  const previewQty = Number.isInteger(parseInt(quantity, 10)) && parseInt(quantity, 10) >= 1 ? parseInt(quantity, 10) : 0;
  const previewSubtotal = previewPrice * previewQty;
  // Total surcharge for the ingredients chosen beyond the ones included in the base price.
  const extrasTotal = sizeInfo ? (previewPrice - sizeInfo.basePrice) * previewQty : 0;
  // Units already in the cart of this size, excluding the line being edited. This is used to compute the provisional discount.
  const otherCartUnits = cart.filter(s => s.key !== editingKey).reduce((sum, s) => sum + s.quantity, 0);
  const previewDiscount = (otherCartUnits + previewQty) >= 4 ? previewSubtotal * 0.20 : 0;
  const previewLineTotal = previewSubtotal - previewDiscount;

  const onSizeChange = (newSize) => {
    setSize(newSize);
    // If the new size allows fewer dressings, trim the current selection.
    const info = sizes.find(s => s.size === newSize);
    if (info && dressings.length > info.maxDressings)
      setDressings(dressings.slice(0, info.maxDressings));
  };

  const toggleIngredient = (name) => {
    setIngredients(prev => prev.includes(name) ? prev.filter(i => i !== name) : [...prev, name]);
  };

  const toggleDressing = (name) => {
    setDressings(prev => {
      if (prev.includes(name)) return prev.filter(d => d !== name);
      if (prev.length >= maxDressings) return prev; // respect the size limit
      return [...prev, name];
    });
  };

  // Clear the optional choices for the next sandwich (size/main/bread are kept for convenience).
  const resetForm = () => { setIngredients([]); setDressings([]); setQuantity('1'); setFormError(''); };

  // Add a new sandwich to the order, or save the changes if a cart line is being edited.
  const handleAdd = () => {
    setFormError('');
    const q = parseInt(quantity, 10);
    if (!Number.isInteger(q) || q < 1) { setFormError('Quantity must be a positive integer'); return; }
    if (q > remaining) {
      setFormError(remaining > 0
        ? `Only ${remaining} ${size} sandwich(es) currently available`
        : `No ${size} sandwiches currently available`);
      return;
    }
    const sandwich = { size, mainIngredient, bread, quantity: q, ingredients: [...ingredients], dressings: [...dressings] };
    if (editingKey !== null) {
      updateCartItem(editingKey, sandwich); // replace the edited line in place
      setEditingKey(null);
    } else {
      addToCart(sandwich);
    }
    resetForm();
    refreshSizes();
  };

  // Load a cart line into the form to modify it. The line stays in the cart (highlighted) until saved.
  const handleEditLine = (item) => {
    setSize(item.size); setMainIngredient(item.mainIngredient); setBread(item.bread);
    setIngredients([...item.ingredients]); setDressings([...item.dressings]);
    setQuantity(String(item.quantity));
    setEditingKey(item.key);
    setFormError('');
  };

  // Leave edit mode without changing the cart line.
  const handleCancelEdit = () => { setEditingKey(null); resetForm(); };

  // Remove a cart line; if it was the one being edited, also leave edit mode.
  const handleRemoveLine = (key) => {
    removeFromCart(key);
    if (key === editingKey) { setEditingKey(null); resetForm(); }
  };

  // Confirm the order, disabling the button while the request is in flight (no double submit).
  const handleConfirm = async () => {
    setConfirming(true);
    try { await confirmOrder(); } finally { setConfirming(false); }
  };

  // Change a cart line quantity, clamped to the currently available amount for its size.
  const handleCartQuantity = (item, value) => {
    const q = parseInt(value, 10);
    if (!Number.isInteger(q) || q < 1) return;
    const info = sizes.find(s => s.size === item.size);
    const maxForLine = info ? info.available - unitsOfSizeInCart(cart, item.size, item.key) : q;
    updateCartQuantity(item.key, Math.min(q, Math.max(1, maxForLine)));
  };

  const units = totalUnits(cart);
  const subtotal = orderSubtotal(cart, sizes);
  const discount = orderDiscount(cart, sizes);
  const total = orderTotal(cart, sizes);

  return (
    <Row className="mt-3">
      {/* --- Sandwich builder --- */}
      <Col lg={5} className="mb-3">
        <Card>
          <Card.Header><strong>{editingKey !== null ? 'Edit sandwich' : 'Configure a sandwich'}</strong></Card.Header>
          <Card.Body>
            {formError && <Alert variant="danger" dismissible onClose={() => setFormError('')}>{formError}</Alert>}

            <Form.Group className="mb-3">
              <Form.Label>Size</Form.Label>
              <Form.Select value={size} onChange={e => onSizeChange(e.target.value)}>
                {sizes.map(s => {
                  // Provisional availability shown only to this user: real availability minus
                  // the units of this size already placed in their (not yet confirmed) cart.
                  const prov = Math.max(0, s.available - unitsOfSizeInCart(cart, s.size, editingKey));
                  return (
                    <option key={s.size} value={s.size}>
                      {SIZE_LABELS[s.size]} ({s.size}) — € {s.basePrice.toFixed(2)}, {prov} available
                    </option>
                  );
                })}
              </Form.Select>
              {outOfStock && (
                <div className="text-danger small mt-1">
                  No {SIZE_LABELS[size]} sandwiches available — pick another size to configure one.
                </div>
              )}
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Main ingredient</Form.Label>
              <Form.Select value={mainIngredient} disabled={outOfStock} onChange={e => setMainIngredient(e.target.value)}>
                {menu.mains.map(m => <option key={m} value={m}>{m}</option>)}
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Bread</Form.Label>
              <Form.Select value={bread} disabled={outOfStock} onChange={e => setBread(e.target.value)}>
                {menu.breads.map(b => <option key={b} value={b}>{b}</option>)}
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>
                Optional ingredients
                {sizeInfo && <span className="text-muted"> ({sizeInfo.includedIngredients} included, +30% each extra)</span>}
              </Form.Label>
              {menu.ingredients.map(i => (
                <Form.Check key={i} type="checkbox" id={`ing-${i}`} label={i}
                  checked={ingredients.includes(i)} disabled={outOfStock} onChange={() => toggleIngredient(i)} />
              ))}
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>
                Dressings <span className="text-muted">(max {maxDressings})</span>
              </Form.Label>
              {menu.dressings.map(d => {
                const checked = dressings.includes(d);
                return (
                  <Form.Check key={d} type="checkbox" id={`dr-${d}`} label={d}
                    checked={checked}
                    disabled={outOfStock || (!checked && dressings.length >= maxDressings)}
                    onChange={() => toggleDressing(d)} />
                );
              })}
            </Form.Group>

            <Form.Group className="mb-3" style={{ maxWidth: '150px' }}>
              <Form.Label>Quantity</Form.Label>
              <Form.Control type="number" min="1" value={quantity} disabled={outOfStock}
                onChange={e => setQuantity(e.target.value)} />
            </Form.Group>

            <div className="mb-3">
              <div>
                Unit price: <strong>{euro(previewPrice)}</strong>
                {extraIngredients > 0 && <span className="text-muted"> ({extraIngredients} extra ingredient(s))</span>}
              </div>
              {extraIngredients > 0 && previewQty > 0 && (
                <div className="text-muted">Extra ingredients cost: + {euro(extrasTotal)}</div>
              )}
              {previewQty > 0 && (
                <div>Subtotal ({previewQty} × {euro(previewPrice)}): <strong>{euro(previewSubtotal)}</strong></div>
              )}
              {previewDiscount > 0 && (
                <div className="text-success">20% order discount (4+ sandwiches): − {euro(previewDiscount)}</div>
              )}
              {previewQty > 0 && (
                <div>Total: <strong>{euro(previewLineTotal)}</strong></div>
              )}
            </div>

            {editingKey !== null ? (
              <>
                <Button onClick={handleAdd}>
                  <i className="bi bi-check-lg" /> Save changes
                </Button>
                <Button variant="outline-secondary" className="ms-2" onClick={handleCancelEdit}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button onClick={handleAdd} disabled={outOfStock}>
                  <i className="bi bi-plus-lg" /> Add to order
                </Button>
              </>
            )}
          </Card.Body>
        </Card>
      </Col>

      {/* --- Current order (cart) --- */}
      <Col lg={7}>
        <Card>
          <Card.Header><strong>Your order</strong></Card.Header>
          <Card.Body>
            {cart.length === 0 ? (
              <p className="text-muted mb-0">No sandwiches added yet. Configure one and add it to your order.</p>
            ) : (
              <>
                <Table responsive bordered size="sm">
                  <thead>
                    <tr>
                      <th>Size</th><th>Main</th><th>Bread</th><th>Ingredients</th>
                      <th>Dressings</th><th>Qty</th><th>Line total</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map(item => {
                      const lineUnit = unitPrice(item.size, item.ingredients.length, sizes);
                      const isEditing = item.key === editingKey;
                      return (
                        <tr key={item.key} className={isEditing ? 'table-warning' : ''}>
                          <td>{item.size}</td>
                          <td>{item.mainIngredient}</td>
                          <td>{item.bread}</td>
                          <td>{item.ingredients.join(', ') || '—'}</td>
                          <td>{item.dressings.join(', ') || '—'}</td>
                          <td style={{ width: '90px' }}>
                            <Form.Control type="number" min="1" size="sm" value={item.quantity}
                              onChange={e => handleCartQuantity(item, e.target.value)} />
                          </td>
                          <td>{euro(lineUnit * item.quantity)}</td>
                          <td className="text-nowrap">
                            {isEditing && <Badge bg="warning" text="dark" className="me-1">editing</Badge>}
                            <Button variant="outline-secondary" size="sm" className="me-1"
                              onClick={() => handleEditLine(item)} title="Edit">
                              <i className="bi bi-pencil" />
                            </Button>
                            <Button variant="outline-danger" size="sm"
                              onClick={() => handleRemoveLine(item.key)} title="Remove">
                              <i className="bi bi-trash" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>

                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    {units >= 4
                      ? <span><Badge bg="success">20% discount applied (4+ sandwiches)</Badge>
                          <span className="text-success ms-2">− {euro(discount)}</span></span>
                      : <span className="text-muted">Add {4 - units} more for a 20% discount</span>}
                  </div>
                  <div className="text-end">
                    {discount > 0 && <div className="text-muted">Subtotal: {euro(subtotal)}</div>}
                    <h4 className="mb-0">Total: {euro(total)}</h4>
                  </div>
                </div>

                <div className="mt-3">
                  <Button variant="success" onClick={handleConfirm} disabled={confirming}>
                    <i className="bi bi-check2-circle" /> {confirming ? 'Confirming…' : 'Confirm order'}
                  </Button>
                </div>
              </>
            )}
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
}

export { Configurator };
