import React, { useState } from 'react';
import {
    LayoutGrid,
    List,
    BarChart3,
    GitBranch,
    Settings,
    Key,
    Shield,
    Activity,
    Globe,
    Zap,
    ChevronRight,
    Server
} from 'lucide-react';
import './Sidebar.css';

interface SidebarProps {
    tenantName: string;
    activeView: string;
    setActiveView: (view: string) => void;
    onGoHome: () => void;
    isAdmin: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
    tenantName,
    activeView,
    setActiveView,
    onGoHome,
    isAdmin
}) => {
    const [expandedGroups, setExpandedGroups] = useState<string[]>(['telemetry', 'monitoring']);

    const toggleGroup = (group: string) => {
        setExpandedGroups(prev =>
            prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
        );
    };

    const navItemClass = (view: string) =>
        `sidebar-nav-item ${activeView === view ? 'active' : ''}`;

    return (
        <aside className="sidebar glass-panel">
            {/* Header */}
            <div className="sidebar-header" onClick={onGoHome}>
                <div className="sidebar-logo-icon">
                    <Activity size={24} />
                </div>
                <span className="sidebar-logo-text">SkyView</span>
            </div>

            {/* Navigation */}
            <nav className="sidebar-nav">
                <button
                    className={navItemClass('overview')}
                    onClick={() => setActiveView('overview')}
                >
                    <LayoutGrid size={18} />
                    <span>Dashboard</span>
                </button>

                {/* Monitoring Group (New) */}
                <div className="sidebar-group">
                    <button
                        className={`sidebar-group-header ${expandedGroups.includes('monitoring') ? 'expanded' : ''}`}
                        onClick={() => toggleGroup('monitoring')}
                    >
                        <div className="flex-row">
                            <Activity size={18} />
                            <span>Monitoring</span>
                        </div>
                        <ChevronRight size={14} className="chevron" />
                    </button>

                    {expandedGroups.includes('monitoring') && (
                        <div className="sidebar-subitems">
                            <button
                                className={navItemClass('uptime')}
                                onClick={() => setActiveView('uptime')}
                            >
                                <Server size={16} />
                                <span>Uptime Monitors</span>
                            </button>
                            <button
                                className={navItemClass('status-pages')}
                                onClick={() => setActiveView('status-pages')}
                            >
                                <Globe size={16} />
                                <span>Status Pages</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Telemetry Group */}
                <div className="sidebar-group">
                    <button
                        className={`sidebar-group-header ${expandedGroups.includes('telemetry') ? 'expanded' : ''}`}
                        onClick={() => toggleGroup('telemetry')}
                    >
                        <div className="flex-row">
                            <Zap size={18} />
                            <span>Telemetry</span>
                        </div>
                        <ChevronRight size={14} className="chevron" />
                    </button>

                    {expandedGroups.includes('telemetry') && (
                        <div className="sidebar-subitems">
                            <button
                                className={navItemClass('logs')}
                                onClick={() => setActiveView('logs')}
                            >
                                <List size={16} />
                                <span>Logs</span>
                            </button>
                            <button
                                className={navItemClass('metrics')}
                                onClick={() => setActiveView('metrics')}
                            >
                                <BarChart3 size={16} />
                                <span>Metrics</span>
                            </button>
                            <button
                                className={navItemClass('traces')}
                                onClick={() => setActiveView('traces')}
                            >
                                <GitBranch size={16} />
                                <span>Traces</span>
                            </button>
                        </div>
                    )}
                </div>

                <div className="sidebar-divider" />

                {/* Config */}
                <button
                    className={navItemClass('integration')}
                    onClick={() => setActiveView('integration')}
                >
                    <Key size={18} />
                    <span>Integration</span>
                </button>

                <button
                    className={navItemClass('settings')}
                    onClick={() => setActiveView('settings')}
                >
                    <Settings size={18} />
                    <span>Settings</span>
                </button>

                {isAdmin && (
                    <button
                        className={`${navItemClass('admin')} admin-item`}
                        onClick={() => setActiveView('admin')}
                    >
                        <Shield size={18} />
                        <span>Admin</span>
                    </button>
                )}
            </nav>

            {/* Footer */}
            <div className="sidebar-footer">
                <div className="tenant-badge">
                    <span className="status-dot"></span>
                    <span className="tenant-name">{tenantName || 'Tenant'}</span>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
