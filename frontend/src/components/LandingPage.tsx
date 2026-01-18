import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, ArrowRight, Shield, BarChart3, Zap, Globe, Layers, Eye, Lock, AlertTriangle, CheckCircle, Menu, X } from 'lucide-react';
import { EyeLogo } from './EyeLogo';
import './LandingPage.css';

interface LandingPageProps {
    onGetStarted: () => void;
}


// Animated Counter Hook
const useCountUp = (end: number, duration: number = 2000, start: number = 0) => {
    const [count, setCount] = useState(start);
    const countRef = useRef(start);
    const [hasStarted, setHasStarted] = useState(false);

    useEffect(() => {
        if (!hasStarted) return;

        const startTime = Date.now();
        const tick = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            countRef.current = Math.floor(start + (end - start) * eased);
            setCount(countRef.current);
            if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }, [hasStarted, end, duration, start]);

    return { count, start: () => setHasStarted(true) };
};

const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
    const navigate = useNavigate();
    const [isErrorMode, setIsErrorMode] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const heroRef = useRef<HTMLDivElement>(null);

    // Animated counters
    const logsCounter = useCountUp(2400000, 2500);
    const uptimeCounter = useCountUp(999, 2000, 900);
    const responseCounter = useCountUp(45, 1500);

    // Start counters when hero is visible
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    logsCounter.start();
                    uptimeCounter.start();
                    responseCounter.start();
                }
            },
            { threshold: 0.3 }
        );
        if (heroRef.current) observer.observe(heroRef.current);
        return () => observer.disconnect();
    }, []);

    // Reset error mode after 3 seconds
    useEffect(() => {
        if (isErrorMode) {
            const timeout = setTimeout(() => setIsErrorMode(false), 3000);
            return () => clearTimeout(timeout);
        }
    }, [isErrorMode]);

    const formatNumber = (num: number) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(0) + 'K';
        return num.toString();
    };



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
                        <EyeLogo variant="light" className="landing-logo-icon" width={80} height={80} />
                    </div>
                    <span className="landing-logo-text">ObseraCloud</span>
                </div>
                <nav className="landing-nav">
                    <a href="#features" className="landing-nav-link">Features</a>
                    <a href="#how-it-works" className="landing-nav-link">How It Works</a>
                    <a href="#pricing" className="landing-nav-link">Pricing</a>
                </nav>
                <div className="landing-header-actions">
                    <button className="landing-login-btn desktop-only" onClick={onGetStarted}>
                        Sign In
                        <ArrowRight className="landing-btn-arrow" />
                    </button>
                    <button className="landing-mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)}>
                        <Menu />
                    </button>
                </div>
            </header>

            {/* Mobile Menu Overlay */}
            <div className={`landing-mobile-menu ${isMobileMenuOpen ? 'open' : ''}`}>
                <div className="landing-mobile-menu-header">
                    <div className="landing-logo">
                        <div className="landing-logo-container">
                            <EyeLogo variant="light" className="landing-logo-icon" width={80} height={80} />
                        </div>
                        <span className="landing-logo-text">ObseraCloud</span>
                    </div>
                    <button className="landing-close-btn" onClick={() => setIsMobileMenuOpen(false)}>
                        <X />
                    </button>
                </div>
                <div className="landing-mobile-nav">
                    <a href="#features" className="landing-mobile-link" onClick={() => setIsMobileMenuOpen(false)}>Features</a>
                    <a href="#how-it-works" className="landing-mobile-link" onClick={() => setIsMobileMenuOpen(false)}>How It Works</a>
                    <a href="#pricing" className="landing-mobile-link" onClick={() => setIsMobileMenuOpen(false)}>Pricing</a>
                    <button className="landing-login-btn full-width" onClick={() => { onGetStarted(); setIsMobileMenuOpen(false); }}>
                        Sign In
                        <ArrowRight className="landing-btn-arrow" />
                    </button>
                </div>
            </div>

            {/* Hero Section */}
            <section className="landing-hero" ref={heroRef}>
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
                        <br />
                        <span style={{ display: 'block', marginTop: '1rem', color: 'var(--primary)', fontWeight: 600, fontSize: '0.9rem' }}>
                            Architected & Built by Abdirashiid Sammantar
                        </span>
                    </p>
                    <div className="landing-cta-group">
                        <button className="landing-cta-primary" onClick={onGetStarted}>
                            Get Started Free
                            <ArrowRight className="landing-btn-arrow" />
                        </button>
                        <button className="landing-cta-secondary" onClick={() => navigate('/demo')}>
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

                {/* Hero Visual - Interactive Dashboard Preview */}
                <div className="landing-hero-visual">
                    <div className={`landing-dashboard-preview ${isErrorMode ? 'error-state' : ''}`}>
                        <div className="landing-preview-header">
                            <div className="landing-preview-dots">
                                <span className="dot" />
                                <span className="dot" />
                                <span className="dot" />
                            </div>
                            <span className="landing-preview-title">Live Dashboard</span>
                            <span className="landing-preview-status">
                                <span className="status-dot" />
                                {isErrorMode ? 'Error Detected' : 'Connected'}
                            </span>
                        </div>
                        <div className="landing-preview-content">
                            <div className="landing-preview-stat">
                                <span className="stat-icon logs">
                                    <Layers className="stat-svg" />
                                </span>
                                <div className="stat-info">
                                    <span className="stat-value">{formatNumber(logsCounter.count)}</span>
                                    <span className="stat-label">Logs Processed</span>
                                </div>
                            </div>
                            <div className="landing-preview-stat">
                                <span className="stat-icon uptime">
                                    <Activity className="stat-svg" />
                                </span>
                                <div className="stat-info">
                                    <span className="stat-value success">
                                        {isErrorMode ? '87.2' : (uptimeCounter.count / 10).toFixed(1)}%
                                    </span>
                                    <span className="stat-label">Uptime</span>
                                </div>
                            </div>
                            <div className="landing-preview-stat">
                                <span className="stat-icon response">
                                    <Zap className="stat-svg" />
                                </span>
                                <div className="stat-info">
                                    <span className="stat-value">{isErrorMode ? '2.4s' : `${responseCounter.count}ms`}</span>
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
                                <div className="chart-bar active" style={{ height: isErrorMode ? '20%' : '95%' }} />
                            </div>
                        </div>
                        {/* Simulate Error Button */}
                        <button
                            className="simulate-error-btn"
                            onClick={() => setIsErrorMode(true)}
                            disabled={isErrorMode}
                        >
                            {isErrorMode ? (
                                <><CheckCircle /> Investigating...</>
                            ) : (
                                <><AlertTriangle /> Simulate Error</>
                            )}
                        </button>
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

            {/* How It Works Section */}
            <section className="landing-features" id="how-it-works">
                <div className="landing-features-header">
                    <span className="landing-section-badge">How It Works</span>
                    <h2 className="landing-features-title">Get started in 3 simple steps</h2>
                    <p className="landing-features-subtitle">
                        From zero to full observability in under 10 minutes.
                    </p>
                </div>
                <div className="landing-features-grid">
                    <div className="landing-feature-card">
                        <div className="landing-feature-icon">
                            <span style={{ fontSize: '1.5rem', fontWeight: 700 }}>1</span>
                        </div>
                        <h3>Integrate Your App</h3>
                        <p>Add the OpenTelemetry SDK to your application. We support Python, Node.js, Go, and more.</p>
                    </div>
                    <div className="landing-feature-card">
                        <div className="landing-feature-icon">
                            <span style={{ fontSize: '1.5rem', fontWeight: 700 }}>2</span>
                        </div>
                        <h3>Send Telemetry</h3>
                        <p>Point your OTLP exporter to ObseraCloud. We'll handle ingestion, storage, and indexing.</p>
                    </div>
                    <div className="landing-feature-card">
                        <div className="landing-feature-icon">
                            <span style={{ fontSize: '1.5rem', fontWeight: 700 }}>3</span>
                        </div>
                        <h3>Get Insights</h3>
                        <p>Explore your logs, metrics, and traces in real-time. Let our AI help you debug issues faster.</p>
                    </div>
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
                        <EyeLogo variant="light" className="landing-logo-icon" width={32} height={32} />
                        <span>ObseraCloud</span>
                    </div>
                    <p>&copy; 2026 ObseraCloud. Designed & Developed by Abdirashiid Sammantar.</p>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
