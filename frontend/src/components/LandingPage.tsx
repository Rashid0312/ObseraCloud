import React from 'react';
import { Activity, ArrowRight, Shield, BarChart3, Zap, Globe, Layers, Eye, Lock } from 'lucide-react';
import './LandingPage.css';

interface LandingPageProps {
    onGetStarted: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
    return (
        <div className="landing-container">
            {/* Background effects */}
            <div className="landing-bg-gradient" />
            <div className="landing-bg-orb landing-bg-orb-1" />
            <div className="landing-bg-orb landing-bg-orb-2" />
            <div className="landing-bg-orb landing-bg-orb-3" />
            <div className="landing-grid-overlay" />

            {/* Header */}
            <header className="landing-header">
                <div className="landing-logo">
                    <div className="landing-logo-container">
                        <Activity className="landing-logo-icon" />
                    </div>
                    <span className="landing-logo-text">ObseraCloud</span>
                </div>
                <nav className="landing-nav">
                    <a href="#features" className="landing-nav-link">Features</a>
                    <a href="#about" className="landing-nav-link">About</a>
                    <a href="#pricing" className="landing-nav-link">Pricing</a>
                </nav>
                <button className="landing-login-btn" onClick={onGetStarted}>
                    Sign In
                    <ArrowRight className="landing-btn-arrow" />
                </button>
            </header>

            {/* Hero Section */}
            <section className="landing-hero">
                <div className="landing-hero-content">
                    <div className="landing-badge">
                        <Shield className="landing-badge-icon" />
                        <span>Enterprise-Grade Observability</span>
                    </div>
                    <h1 className="landing-title">
                        Monitor Everything.
                        <br />
                        <span className="landing-title-highlight">Miss Nothing.</span>
                    </h1>
                    <p className="landing-subtitle">
                        ObseraCloud is a multi-tenant observability platform that gives you complete visibility
                        into your applications with real-time logs, metrics, and distributed traces.
                    </p>
                    <div className="landing-cta-group">
                        <button className="landing-cta-primary" onClick={onGetStarted}>
                            Get Started Free
                            <ArrowRight className="landing-btn-arrow" />
                        </button>
                        <button className="landing-cta-secondary">
                            <Eye className="landing-btn-icon-left" />
                            Watch Demo
                        </button>
                    </div>
                    <div className="landing-trust-badges">
                        <span className="landing-trust-item">
                            <Lock className="landing-trust-icon" />
                            SOC2 Compliant
                        </span>
                        <span className="landing-trust-divider" />
                        <span className="landing-trust-item">99.99% Uptime SLA</span>
                        <span className="landing-trust-divider" />
                        <span className="landing-trust-item">Enterprise Ready</span>
                    </div>
                </div>

                {/* Hero Visual */}
                <div className="landing-hero-visual">
                    <div className="landing-dashboard-preview">
                        <div className="landing-preview-header">
                            <div className="landing-preview-dots">
                                <span className="dot" />
                                <span className="dot" />
                                <span className="dot" />
                            </div>
                            <span className="landing-preview-title">Live Dashboard</span>
                            <span className="landing-preview-status">
                                <span className="status-dot" />
                                Connected
                            </span>
                        </div>
                        <div className="landing-preview-content">
                            <div className="landing-preview-stat">
                                <span className="stat-icon logs">
                                    <Layers className="stat-svg" />
                                </span>
                                <div className="stat-info">
                                    <span className="stat-value">2.4M</span>
                                    <span className="stat-label">Logs Processed</span>
                                </div>
                            </div>
                            <div className="landing-preview-stat">
                                <span className="stat-icon uptime">
                                    <Activity className="stat-svg" />
                                </span>
                                <div className="stat-info">
                                    <span className="stat-value success">99.9%</span>
                                    <span className="stat-label">Uptime</span>
                                </div>
                            </div>
                            <div className="landing-preview-stat">
                                <span className="stat-icon response">
                                    <Zap className="stat-svg" />
                                </span>
                                <div className="stat-info">
                                    <span className="stat-value">45ms</span>
                                    <span className="stat-label">Avg Response</span>
                                </div>
                            </div>
                        </div>
                        <div className="landing-preview-chart">
                            <div className="chart-bars">
                                <div className="chart-bar" style={{ height: '60%' }} />
                                <div className="chart-bar" style={{ height: '80%' }} />
                                <div className="chart-bar" style={{ height: '45%' }} />
                                <div className="chart-bar" style={{ height: '90%' }} />
                                <div className="chart-bar" style={{ height: '70%' }} />
                                <div className="chart-bar" style={{ height: '85%' }} />
                                <div className="chart-bar" style={{ height: '55%' }} />
                                <div className="chart-bar active" style={{ height: '95%' }} />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="landing-features" id="features">
                <div className="landing-features-header">
                    <span className="landing-section-badge">Features</span>
                    <h2 className="landing-features-title">Everything you need to monitor at scale</h2>
                    <p className="landing-features-subtitle">
                        Built for modern teams who need reliable, real-time observability without the complexity.
                    </p>
                </div>
                <div className="landing-features-grid">
                    <div className="landing-feature-card">
                        <div className="landing-feature-icon">
                            <BarChart3 />
                        </div>
                        <h3>Real-Time Metrics</h3>
                        <p>Monitor application performance with live dashboards, customizable alerts, and intelligent anomaly detection.</p>
                    </div>
                    <div className="landing-feature-card">
                        <div className="landing-feature-icon">
                            <Zap />
                        </div>
                        <h3>Blazing Fast Search</h3>
                        <p>Search through millions of logs instantly with our optimized query engine. Full-text search across all your data.</p>
                    </div>
                    <div className="landing-feature-card">
                        <div className="landing-feature-icon">
                            <Globe />
                        </div>
                        <h3>Distributed Tracing</h3>
                        <p>Track requests across services and identify bottlenecks in your system with end-to-end visibility.</p>
                    </div>
                </div>
            </section>

            {/* About Section */}
            <section className="landing-features" id="about" style={{ background: 'var(--background)' }}>
                <div className="landing-features-header">
                    <span className="landing-section-badge">About Us</span>
                    <h2 className="landing-features-title">Observability for Everyone</h2>
                    <p className="landing-features-subtitle">
                        We believe that understanding your production systems shouldn't require a PhD in distributed systems.
                        ObseraCloud makes enterprise-grade monitoring accessible to every developer.
                    </p>
                </div>
            </section>

            {/* Pricing Section */}
            <section className="landing-features" id="pricing">
                <div className="landing-features-header">
                    <span className="landing-section-badge">Pricing</span>
                    <h2 className="landing-features-title">Simple, Transparent Pricing</h2>
                    <p className="landing-features-subtitle">
                        Start for free, scale as you grow. No hidden fees or surprise overages.
                    </p>
                </div>
                {/* Pricing Grid Placeholder */}
                <div className="landing-features-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
                    <div className="landing-feature-card" style={{ textAlign: 'center' }}>
                        <h3>Starter</h3>
                        <div style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '1rem 0' }}>$0</div>
                        <p>Perfect for side projects and hobbyists.</p>
                        <button className="landing-cta-secondary" style={{ width: '100%', marginTop: '1rem', justifyContent: 'center' }}>Start Free</button>
                    </div>
                    <div className="landing-feature-card" style={{ textAlign: 'center', borderColor: 'var(--primary)' }}>
                        <h3>Pro</h3>
                        <div style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '1rem 0' }}>$49</div>
                        <p>For growing teams and production apps.</p>
                        <button className="landing-cta-primary" style={{ width: '100%', marginTop: '1rem', justifyContent: 'center' }}>Get Pro</button>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="landing-footer">
                <div className="landing-footer-content">
                    <div className="landing-footer-brand">
                        <Activity className="landing-footer-logo" />
                        <span>ObseraCloud</span>
                    </div>
                    <p>&copy; 2024 ObseraCloud. Built for developers, by developers.</p>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
