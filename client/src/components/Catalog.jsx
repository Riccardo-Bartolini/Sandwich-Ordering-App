import { Card, Row, Col, Badge } from 'react-bootstrap';
import { SIZE_LABELS } from '../pricing.js';

// Availability and prices of the three sandwich sizes (publicly visible), shown as cards.
function SizeAvailability(props) {
  return (
    <Row>
      {props.sizes.map(s => (
        <Col md={4} className="mb-3" key={s.size}>
          <Card className="h-100">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-baseline">
                <Card.Title className="mb-0">{SIZE_LABELS[s.size] || s.size}</Card.Title>
                <span className="text-muted">({s.size})</span>
              </div>
              <div className="fs-3 fw-semibold my-2">€ {s.basePrice.toFixed(2)}</div>
              <Badge bg={s.available > 0 ? 'success' : 'secondary'}>
                {s.available} / {s.dailyMax} available
              </Badge>
              <div className="text-secondary mt-2">
                {s.includedIngredients} ingredients included · max {s.maxDressings} dressing{s.maxDressings > 1 ? 's' : ''}
              </div>
            </Card.Body>
          </Card>
        </Col>
      ))}
    </Row>
  );
}

// The lists of choices available for building a sandwich (publicly visible), shown as pill tags.
function MenuOverview(props) {
  const { menu } = props;
  const block = (title, items) => (
    <Col md={3} sm={6} className="mb-3" key={title}>
      <Card className="h-100">
        <Card.Header className="fw-bold fs-5">{title}</Card.Header>
        <Card.Body className="d-flex flex-wrap align-items-start align-content-start gap-2">
          {items.map(i => (
            <Badge key={i} pill bg="light" text="dark" className="border">{i}</Badge>
          ))}
        </Card.Body>
      </Card>
    </Col>
  );
  return (
    <Row>
      {block('Main ingredients', menu.mains)}
      {block('Bread', menu.breads)}
      {block('Optional ingredients', menu.ingredients)}
      {block('Dressings', menu.dressings)}
    </Row>
  );
}

export { SizeAvailability, MenuOverview };
