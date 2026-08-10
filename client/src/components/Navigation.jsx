import 'bootstrap-icons/font/bootstrap-icons.css';
import { Navbar, Nav, Badge, Button } from 'react-bootstrap';
import { Link, NavLink, useNavigate } from 'react-router';
import { LoginButton, LogoutButton } from './Auth';

const Navigation = (props) => {
  const navigate = useNavigate();
  const { loggedIn, loggedInTotp, user } = props;

  return (
    <Navbar bg="primary" variant="dark" expand="md" className="px-3">
      <Navbar.Brand as={Link} to="/">
        <i className="bi bi-shop mx-2" />
        Sandwich Shop
      </Navbar.Brand>

      <Nav className="me-auto">
        <Nav.Link as={NavLink} to="/" end>Home</Nav.Link>
        {loggedIn && <Nav.Link as={NavLink} to="/configurator">Create order</Nav.Link>}
        {loggedIn && <Nav.Link as={NavLink} to="/orders">My orders</Nav.Link>}
      </Nav>

      <Nav className="align-items-center">
        {loggedIn && (
          <Navbar.Text className="mx-2 text-white">
            {user?.name} {loggedInTotp && <Badge bg="success">2FA</Badge>}
            {' '}· Credit: € {user?.credit?.toFixed(2)}
          </Navbar.Text>
        )}
        {loggedIn && user?.canDoTotp && !loggedInTotp && (
          <Button variant="outline-light" size="sm" className="mx-2"
            onClick={() => navigate('/login')}>Enable 2FA</Button>
        )}
        <span className="mx-2">{loggedIn ? <LogoutButton logout={props.logout} /> : <LoginButton />}</span>
      </Nav>
    </Navbar>
  );
};

export { Navigation };
