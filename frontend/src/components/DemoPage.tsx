import React from 'react';
import { ArrowLeft, Play, LayoutDashboard, Activity, Terminal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css'; // Reuse landing page styles for consistency

const DemoPage: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="landing-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <header className="landing-header">
                <div className="landing-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
                    <div className="landing-logo-container">
                        <Activity className="landing-logo-icon" />
                    </div>
                    <span className="landing-logo-text">ObseraCloud</span>
                </div>
                <button className="landing-login-btn" onClick={() => navigate('/')}>
                    <ArrowLeft className="landing-btn-arrow" style={{ transform: 'rotate(0)', marginRight: '8px' }} />
                    Back to Home
                </button>
            </header>

            <div className="landing-hero" style={{ paddingTop: '120px', paddingBottom: '60px' }}>
                <div className="landing-hero-content">
                    <div className="landing-badge">
                        <Play className="landing-badge-icon" />
                        <span>Interactive Walkthrough</span>
                    </div>
                    <h1 className="landing-title">
                        See ObseraCloud
                        <br />
                        <span className="landing-title-highlight">In Action.</span>
                    </h1>
                    <p className="landing-subtitle">
                        Experience the power of real-time multi-tenant observability.
                        Watch how we handle logs, metrics, and traces at scale.
                    </p>
                </div>
            </div>

            {/* Demo Content */}
            <div className="landing-features" style={{ paddingTop: '0' }}>
                <div className="landing-features-grid" style={{ gridTemplateColumns: '1fr', maxWidth: '1000px' }}>

                    {/* Placeholder for Video/Screenshots */}
                    <div className="landing-feature-card" style={{ padding: '0', overflow: 'hidden', aspectRatio: '16/9', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(45deg, #1a1a2e, #16213e)', opacity: 0.8 }}></div>

                        <div style={{ zIndex: 2, textAlign: 'center' }}>
                            <div style={{
                                width: '80px',
                                height: '80px',
                                borderRadius: '50%',
                                background: 'rgba(255,255,255,0.1)',
                                border: '2px solid rgba(255,255,255,0.2)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 20px',
                                cursor: 'pointer',
                                backdropFilter: 'blur(10px)'
                            }}>
                                <Play fill="white" stroke="none" size={32} />
                            </div>
                            <h3 style={{ color: 'white', marginBottom: '8px' }}>Watch Product Tour</h3>
                            <p style={{ color: 'rgba(255,255,255,0.6)' }}>2:45 • high-res</p>
                        </div>
                    </div>

                    {/* Feature Highlights */}
                    <div className="landing-features-grid" style={{ marginTop: '40px', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
                        <div className="landing-feature-card">
                            <div className="landing-feature-icon">
                                <LayoutDashboard />
                            </div>
                            <h3>Unified Dashboard</h3>
                            <p>See all your critical metrics in one single pane of glass.</p>
                        </div>
                        <div className="landing-feature-card">
                            <div className="landing-feature-icon">
                                <Terminal />
                            </div>
                            <h3>Live Logs</h3>
                            <p>Stream logs in real-time with powerful filtering capabilities.</p>
                        </div>
                        <div className="landing-feature-card">
                            <div className="landing-feature-icon">
                                <Activity />
                            </div>
                            <h3>Trace Analysis</h3>
                            <p>Deep dive into request latency and performance bottlenecks.</p>
                        </div>
                    </div>

                    {/* CTA */}
                    <div style={{ textAlign: 'center', marginTop: '60px', padding: '40px', background: 'var(--card)', borderRadius: '24px', border: '1px solid var(--border)' }}>
                        <h2 style={{ fontSize: '2rem', marginBottom: '16px' }}>Ready to get started?</h2>
                        <p style={{ color: 'var(--muted-foreground)', marginBottom: '32px' }}>
                            We are currently in private beta. Contact our sales team for early access.
                        </p>
                        <a href="mailto:sales@obseracloud.com" className="landing-cta-primary" style={{ display: 'inline-flex', textDecoration: 'none' }}>
                            Contact Sales
                        </a>
                    </div>

                </div>
            </div>

            {/* Footer */}
            <footer className="landing-footer" style={{ marginTop: 'auto' }}>
                <div className="landing-footer-content">
                    <div className="landing-footer-brand">
                        <Activity className="landing-footer-logo" />
                        <span>ObseraCloud</span>
                    </div>
                    <p>&copy; 2026 ObseraCloud. Designed & Developed by Abdirashiid Sammantar.</p>
                </div>
            </footer>
        </div>
    );
};

export default DemoPage;
