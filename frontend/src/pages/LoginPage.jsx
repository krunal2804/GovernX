import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { HiOutlineEye, HiOutlineEyeOff } from 'react-icons/hi';

export default function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const [showPassword, setShowPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [mode, setMode] = useState('login'); // login | request | verify | reset
    const [resetEmail, setResetEmail] = useState('');
    const [resetCode, setResetCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            await login(email, password);
            navigate('/');
        } catch (err) {
            const errorMsg = err.response?.data?.error || 'Something went wrong. Please try again.';
            setError(errorMsg);
            if (errorMsg === 'Incorrect password') setPassword('');
        } finally {
            setLoading(false);
        }
    };

    const handleResetRequest = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');
        try {
            await api.post('/auth/password-reset/request', { email: resetEmail });
            setSuccess('Verification code sent to your email.');
            setMode('verify');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to send verification code.');
        } finally {
            setLoading(false);
        }
    };

    const handleResetVerify = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');
        try {
            await api.post('/auth/password-reset/verify', { email: resetEmail, code: resetCode });
            setSuccess('Code verified. Set your new password.');
            setMode('reset');
        } catch (err) {
            const errorMsg = err.response?.data?.error || 'Failed to verify code.';
            setError(errorMsg);
            if (errorMsg.includes('Please request a new code')) {
                setMode('request');
                setResetCode('');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleResetConfirm = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        if (newPassword.length < 6) {
            setError('New password must be at least 6 characters.');
            setLoading(false);
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            setLoading(false);
            return;
        }

        try {
            await api.post('/auth/password-reset/confirm', {
                email: resetEmail,
                code: resetCode,
                new_password: newPassword,
            });
            setSuccess('Password reset successful. Please sign in.');
            setMode('login');
            setEmail(resetEmail);
            setPassword('');
            setResetCode('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to reset password.');
        } finally {
            setLoading(false);
        }
    };

    const renderHeader = () => {
        if (mode === 'request') return { title: 'Forgot Password', subtitle: 'Enter your email to receive a 6-digit code.' };
        if (mode === 'verify') return { title: 'Verify Code', subtitle: 'Enter the 6-digit code sent to your email.' };
        if (mode === 'reset') return { title: 'Set New Password', subtitle: 'Choose a strong new password.' };
        return { title: 'Welcome back', subtitle: 'Please enter your account details.' };
    };

    const header = renderHeader();

    return (
        <div className="login-page fade-in">
            <div className="login-side-panel">
                <div className="brand-content">
                    <div className="logo-wrap">
                        <img
                            src="/logo.png"
                            alt="GovernX Logo"
                            style={{ width: '48px', height: '48px', objectFit: 'contain' }}
                        />
                        <h2>GovernX</h2>
                    </div>
                    <h1>Elevate your Project Governance</h1>
                    <p>
                        A unified platform designed for precision, transparency, and seamless execution.
                        Track progress, manage risks, and deliver excellence with ease.
                    </p>
                </div>
            </div>

            <div className="login-form-panel">
                <div className="login-form-container">
                    <div className="login-form-header">
                        <h2>{header.title}</h2>
                        <p>{header.subtitle}</p>
                    </div>

                    {error && <div className="login-error">{error}</div>}
                    {success && (
                        <div style={{ background: 'var(--success-light)', color: 'var(--success)', padding: '12px 16px', borderRadius: 'var(--radius-md)', fontSize: '13px', marginBottom: '24px', border: '1px solid rgba(16, 185, 129, 0.1)', fontWeight: 600 }}>
                            {success}
                        </div>
                    )}

                    {mode === 'login' && (
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>Email Address</label>
                                <input type="email" className="form-control" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                            </div>

                            <div className="form-group">
                                <label>Password</label>
                                <div style={{ position: 'relative' }}>
                                    <input type={showPassword ? "text" : "password"} className="form-control password-input" placeholder="********" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ paddingRight: '40px' }} />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                                        {showPassword ? <HiOutlineEyeOff size={18} /> : <HiOutlineEye size={18} />}
                                    </button>
                                </div>
                                <div style={{ marginTop: '8px' }}>
                                    <a
                                        href="#"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            setError('');
                                            setSuccess('');
                                            setResetEmail(email || '');
                                            setMode('request');
                                        }}
                                        style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}
                                    >
                                        Forgot Password?
                                    </a>
                                </div>
                            </div>

                            <button type="submit" className="btn btn-primary" disabled={loading}>
                                {loading ? 'Processing...' : 'Sign In'}
                            </button>
                        </form>
                    )}

                    {mode === 'request' && (
                        <form onSubmit={handleResetRequest}>
                            <div className="form-group">
                                <label>Email Address</label>
                                <input type="email" className="form-control" placeholder="you@company.com" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required />
                            </div>
                            <button type="submit" className="btn btn-primary" disabled={loading}>
                                {loading ? 'Sending...' : 'Send Code'}
                            </button>
                            <div className="login-footer">
                                <a href="#" onClick={(e) => { e.preventDefault(); setMode('login'); setError(''); setSuccess(''); }}>Back to Sign In</a>
                            </div>
                        </form>
                    )}

                    {mode === 'verify' && (
                        <form onSubmit={handleResetVerify}>
                            <div className="form-group">
                                <label>6-Digit Verification Code</label>
                                <input type="text" inputMode="numeric" maxLength={6} className="form-control" placeholder="123456" value={resetCode} onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))} required />
                            </div>
                            <button type="submit" className="btn btn-primary" disabled={loading}>
                                {loading ? 'Verifying...' : 'Verify Code'}
                            </button>
                            <div className="login-footer">
                                <a href="#" onClick={(e) => { e.preventDefault(); setMode('request'); setError(''); setSuccess(''); }}>Resend / Change Email</a>
                            </div>
                        </form>
                    )}

                    {mode === 'reset' && (
                        <form onSubmit={handleResetConfirm}>
                            <div className="form-group">
                                <label>New Password</label>
                                <div style={{ position: 'relative' }}>
                                    <input type={showNewPassword ? "text" : "password"} className="form-control password-input" placeholder="********" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required style={{ paddingRight: '40px' }} />
                                    <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                                        {showNewPassword ? <HiOutlineEyeOff size={18} /> : <HiOutlineEye size={18} />}
                                    </button>
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Confirm New Password</label>
                                <div style={{ position: 'relative' }}>
                                    <input type={showConfirmPassword ? "text" : "password"} className="form-control password-input" placeholder="********" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required style={{ paddingRight: '40px' }} />
                                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                                        {showConfirmPassword ? <HiOutlineEyeOff size={18} /> : <HiOutlineEye size={18} />}
                                    </button>
                                </div>
                            </div>
                            <button type="submit" className="btn btn-primary" disabled={loading}>
                                {loading ? 'Updating...' : 'Reset Password'}
                            </button>
                            <div className="login-footer">
                                <a href="#" onClick={(e) => { e.preventDefault(); setMode('verify'); setError(''); setSuccess(''); }}>Back to Code Verification</a>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
