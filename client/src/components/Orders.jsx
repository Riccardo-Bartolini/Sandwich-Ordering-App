import { useEffect, useState } from 'react';
import { Card, Table, Button, Row, Col, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router';
import { euro, SIZE_LABELS } from '../pricing.js';

function Orders(props) {
  const { orders, refreshOrders, duplicateOrder, removeOrder, loggedInTotp } = props;
  const navigate = useNavigate();

  // Id of the order currently being deleted, to disable its button and avoid a double submit.
  const [deletingId, setDeletingId] = useState(null);

  // Load the user's orders when entering the page.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { refreshOrders(); }, []);

  const handleDelete = async (id) => {
    setDeletingId(id);
    try { await removeOrder(id); } finally { setDeletingId(null); }
  };

  return (
    <div className="mt-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="mb-0">My orders</h2>
        <Button onClick={() => navigate('/configurator')}>
          <i className="bi bi-plus-lg" /> Create a new order
        </Button>
      </div>

      {!loggedInTotp && (
        <Alert variant="info">
          Deleting orders requires two-factor authentication.{' '}
          <Alert.Link onClick={() => navigate('/login')} style={{ cursor: 'pointer' }}>
            Enable 2FA
          </Alert.Link>.
        </Alert>
      )}

      {orders.length === 0 ? (
        <p className="text-muted">You have no confirmed orders yet.</p>
      ) : (
        orders.map(order => (
          <Card key={order.id} className="mb-3">
            <Card.Header className="d-flex justify-content-between align-items-center">
              <strong>Total: {euro(order.total)}</strong>
              <div>
                <Button variant="outline-primary" size="sm" className="me-2"
                  onClick={() => duplicateOrder(order)}>
                  <i className="bi bi-files" /> Duplicate
                </Button>
                <Button variant="outline-danger" size="sm"
                  disabled={!loggedInTotp || deletingId === order.id}
                  title={loggedInTotp ? 'Delete order' : 'Enable 2FA to delete'}
                  onClick={() => handleDelete(order.id)}>
                  <i className="bi bi-trash" /> {deletingId === order.id ? 'Deleting…' : 'Delete'}
                </Button>
              </div>
            </Card.Header>
            <Card.Body>
              <Table responsive bordered size="sm" className="mb-0">
                <thead>
                  <tr>
                    <th>Size</th><th>Main</th><th>Bread</th>
                    <th>Ingredients</th><th>Dressings</th><th>Qty</th><th>Unit price</th>
                  </tr>
                </thead>
                <tbody>
                  {order.sandwiches.map(s => (
                    <tr key={s.id}>
                      <td>{SIZE_LABELS[s.size]} ({s.size})</td>
                      <td>{s.mainIngredient}</td>
                      <td>{s.bread}</td>
                      <td>{s.ingredients.join(', ') || '—'}</td>
                      <td>{s.dressings.join(', ') || '—'}</td>
                      <td>{s.quantity}</td>
                      <td>{euro(s.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        ))
      )}
    </div>
  );
}

export { Orders };
