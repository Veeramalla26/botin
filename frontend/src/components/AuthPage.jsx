import { useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../firebase';
import '../App.css';

export default function AuthPage({ onAuthSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (name.trim()) {
          await updateProfile(cred.user, { displayName: name.trim() });
        }
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onAuthSuccess();
    } catch (err) {
      const code = err.code?.replace('auth/', '') || '';
      const messages = {
        'invalid-credential': 'Invalid email or password. Try signing up if you don\'t have an account yet.',
        'user-not-found': 'No account found with this email. Please sign up first.',
        'wrong-password': 'Incorrect password.',
        'email-already-in-use': 'This email is already registered. Try signing in.',
        'weak-password': 'Password must be at least 6 characters.',
        'invalid-email': 'Please enter a valid email address.',
        'too-many-requests': 'Too many attempts. Please wait and try again.',
        'api-key-not-valid.-please-pass-a-valid-api-key.': 'Firebase rejected the API key. In Google Cloud → Credentials, set the key to "Don\'t restrict key", save, wait 5 min, then retry.',
        'requests-to-this-api-identitytoolkit-method-google.cloud.identitytoolkit.v1.authenticationservice.signup-are-blocked.': 'Sign-up is blocked. Enable Identity Toolkit API in Google Cloud, then allow it on your API key.',
      };
      setError(messages[code] || `${err.code || 'Error'}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="setup-overlay">
      <form className="setup-form" onSubmit={handleSubmit}>
        <h2>{isSignUp ? 'Create Account' : 'Sign In'}</h2>
        <p className="auth-subtitle">Interview Bot — Firebase Auth</p>

        {isSignUp && (
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password (min 6 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />

        {error && <div className="auth-error">{error}</div>}

        <button type="submit" disabled={loading}>
          {loading ? 'Please wait...' : isSignUp ? 'Sign Up' : 'Sign In'}
        </button>

        <button
          type="button"
          className="auth-toggle"
          onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
        >
          {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
        </button>
      </form>
    </div>
  );
}
