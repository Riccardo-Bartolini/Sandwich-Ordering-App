import { useState } from 'react';
import { Form, Button, Alert, Col, Row } from 'react-bootstrap';
import { useNavigate } from 'react-router';
import API from '../API.js';

// Second factor: enter the TOTP code, or skip it (2FA is optional in this application).
function TotpForm(props) {
  const [totpCode, setTotpCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (event) => {
    event.preventDefault();
    setErrorMessage('');
    if (totpCode === '' || totpCode.length !== 6) {
      setErrorMessage('The code must be exactly 6 digits');
      return;
    }
    API.totpVerify(totpCode)
      .then(() => { props.totpSuccessful(); navigate('/'); })
      .catch(() => setErrorMessage('Wrong code, please try again'));
  };

  return (
    <Row className="justify-content-center mt-4">
      <Col md={5}>
        <h2>Two-factor authentication</h2>
        <p>Optional: enter the code from your authenticator app to enable order deletion.</p>
        <Form onSubmit={handleSubmit}>
          {errorMessage && <Alert variant="danger" dismissible onClose={() => setErrorMessage('')}>{errorMessage}</Alert>}
          <Form.Group controlId="totpCode" className="mb-3">
            <Form.Label>Code</Form.Label>
            <Form.Control type="text" value={totpCode} autoFocus
              onChange={ev => setTotpCode(ev.target.value)} />
          </Form.Group>
          <Button type="submit">Validate</Button>
          <Button variant="secondary" className="mx-2" onClick={() => navigate('/')}>Skip</Button>
        </Form>
      </Col>
    </Row>
  );
}

// Username + password login. Credentials are pre-filled to speed up testing.
function LoginForm(props) {
  const [username, setUsername] = useState('u1@p.it');
  const [password, setPassword] = useState('pwd');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    setErrorMessage('');
    if (!username) { setErrorMessage('Username cannot be empty'); return; }
    if (!password) { setErrorMessage('Password cannot be empty'); return; }
    props.login({ username, password })
      .catch(err => setErrorMessage(err.error || 'Login failed'));
  };

  return (
    <Row className="justify-content-center mt-4">
      <Col md={5}>
        <h1 className="pb-3">Login</h1>
        <Form onSubmit={handleSubmit}>
          {errorMessage && <Alert variant="danger" dismissible onClose={() => setErrorMessage('')}>{errorMessage}</Alert>}
          <Form.Group className="mb-3">
            <Form.Label>Email</Form.Label>
            <Form.Control type="email" value={username} placeholder="Example: u1@p.it"
              onChange={ev => setUsername(ev.target.value)} />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Password</Form.Label>
            <Form.Control type="password" value={password} placeholder="Enter your password"
              onChange={ev => setPassword(ev.target.value)} />
          </Form.Group>
          <Button type="submit">Login</Button>
        </Form>
      </Col>
    </Row>
  );
}

function LogoutButton(props) {
  return <Button variant="outline-light" onClick={props.logout}>Logout</Button>;
}

function LoginButton() {
  const navigate = useNavigate();
  return <Button variant="outline-light" onClick={() => navigate('/login')}>Login</Button>;
}

export { LoginForm, TotpForm, LoginButton, LogoutButton };
