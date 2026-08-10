import { Row, Col, Button, Alert, Container } from 'react-bootstrap';
import { Outlet, Link } from 'react-router';

import { Navigation } from './Navigation';
import { LoginForm, TotpForm } from './Auth';
import { SizeAvailability, MenuOverview } from './Catalog.jsx';
import { Configurator } from './Configurator.jsx';
import { Orders } from './Orders.jsx';

// Shell shared by all the main pages: navigation bar, feedback message and routed content.
function GenericLayout(props) {
  return (
    <>
      <Navigation loggedIn={props.loggedIn} user={props.user}
        loggedInTotp={props.loggedInTotp} logout={props.logout} />
      <Container fluid className="px-4">
        {props.message && (
          <Row><Col>
            <Alert className="my-2" variant={props.message.type} dismissible onClose={() => props.setMessage('')}>
              {props.message.text}
            </Alert>
          </Col></Row>
        )}
        <Outlet />
      </Container>
    </>
  );
}

// Public home page: current availability and the full menu.
function HomeLayout(props) {
  return (
    <div className="mt-3">
      <h2>Today's availability</h2>
      <SizeAvailability sizes={props.sizes} />
      <h2 className="mt-4">Menu</h2>
      <MenuOverview menu={props.menu} />
      {props.loggedIn && (
        <Link to="/configurator">
          <Button className="mt-2"><i className="bi bi-plus-lg" /> Create an order</Button>
        </Link>
      )}
    </div>
  );
}

function ConfiguratorLayout(props) {
  return <Configurator {...props} />;
}

function OrdersLayout(props) {
  return <Orders {...props} />;
}

// Minimal header with an explicit button back to the public home page, used on the login/TOTP pages.
function AuthHeader() {
  return (
    <div className="p-3 border-bottom d-flex justify-content-between align-items-center">
      <span className="fs-5"><i className="bi bi-shop mx-2" />Sandwich Shop</span>
      <Button as={Link} to="/" variant="outline-primary" size="sm">
        <i className="bi bi-house-door me-1" />Back to home
      </Button>
    </div>
  );
}

function LoginLayout(props) {
  return (<><AuthHeader /><LoginForm login={props.login} /></>);
}

function TotpLayout(props) {
  return (<><AuthHeader /><TotpForm totpSuccessful={props.totpSuccessful} setLoggedIn={props.setLoggedIn} /></>);
}

function NotFoundLayout() {
  return (
    <div className="mt-4 text-center">
      <h2>This page does not exist</h2>
      <Link to="/"><Button>Go back to the home page</Button></Link>
    </div>
  );
}

export {
  GenericLayout, NotFoundLayout, HomeLayout,
  ConfiguratorLayout, OrdersLayout, LoginLayout, TotpLayout,
};
