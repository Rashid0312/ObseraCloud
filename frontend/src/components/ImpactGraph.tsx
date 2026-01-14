import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { API_BASE_URL } from '../config';

interface ImpactData {
    bucket: string;
    success_count: number;
    error_count: number;
}

interface ImpactGraphProps {
    slug: string;
    token?: string;
}

const ImpactGraph: React.FC<ImpactGraphProps> = ({ slug, token }) => {
    const [data, setData] = useState<ImpactData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchImpact = async () => {
            try {
                const headers: any = {};
                if (token) headers['Authorization'] = `Bearer ${token}`;

                const res = await fetch(`${API_BASE_URL}/api/status-pages/public/${slug}/impact`, { headers });
                if (res.ok) {
                    const json = await res.json();
                    setData(json.data || []);
                }
            } catch (e) {
                console.error("Failed to load impact graph", e);
            } finally {
                setLoading(false);
            }
        };
        fetchImpact();
    }, [slug, token]);

    if (loading) return <div className="animate-pulse h-64 bg-white/5 rounded-lg"></div>;
    if (data.length === 0) return null;

    return (
        <div className="impact-graph glass-panel mt-6 p-6">
            <h3 className="text-xl font-semibold mb-4 text-white">System Impact & Reliability (24h)</h3>
            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorError" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                        <XAxis
                            dataKey="bucket"
                            tickFormatter={(str) => new Date(str).getHours() + ':00'}
                            stroke="#666"
                            tick={{ fill: '#888', fontSize: 12 }}
                        />
                        <YAxis stroke="#666" tick={{ fill: '#888', fontSize: 12 }} />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F3F4F6' }}
                            labelFormatter={(label) => new Date(label).toLocaleString()}
                        />
                        <Area
                            type="monotone"
                            dataKey="error_count"
                            stroke="#EF4444"
                            fillOpacity={1}
                            fill="url(#colorError)"
                            name="Errors"
                            stackId="1"
                        />
                        <Area
                            type="monotone"
                            dataKey="success_count"
                            stroke="#10B981"
                            fillOpacity={1}
                            fill="url(#colorSuccess)"
                            name="Successful Requests"
                            stackId="1"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default ImpactGraph;
