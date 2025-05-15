import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import LoadingSpinner from '../../LoadingSpinner';

interface HistoryEntry {
    version: number;
    update_index: number;
    token_uri: string;
    timestamp: string;
}

interface HistoryData {
    token_id: string;
    total_updates: number;
    history: HistoryEntry[];
}

const NFTHistory: React.FC = () => {
    const { tokenId } = useParams<{ tokenId: string }>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [historyData, setHistoryData] = useState<HistoryData | null>(null);
    const [expandedVersions, setExpandedVersions] = useState<Set<number>>(new Set());

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await fetch(`/api/nft/${tokenId}/history`);
                if (!res.ok) throw new Error('Failed to fetch history');
                const data = await res.json();
                setHistoryData(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An error occurred');
            } finally {
                setLoading(false);
            }
        };

        if (tokenId) {
            fetchHistory();
        }
    }, [tokenId]);

    const toggleVersion = async (version: number, uri: string) => {
        if (expandedVersions.has(version)) {
            setExpandedVersions(prev => {
                const next = new Set(prev);
                next.delete(version);
                return next;
            });
            return;
        }

        try {
            const cid = uri.replace('ipfs://', '');
            const res = await fetch(`https://ipfs.io/ipfs/${cid}`);
            if (!res.ok) throw new Error('Failed to fetch metadata');
            const metadata = await res.json();
            
            // Store metadata in state if needed
            console.log('Version metadata:', metadata);
            
            setExpandedVersions(prev => {
                const next = new Set(prev);
                next.add(version);
                return next;
            });
        } catch (err) {
            console.error('Error fetching version metadata:', err);
        }
    };

    if (loading) return <div className="flex justify-center"><LoadingSpinner /></div>;
    if (error) return <div className="text-red-500">Error: {error}</div>;
    if (!historyData) return <div>No history found</div>;

    return (
        <div className="max-w-4xl mx-auto p-6">
            <h1 className="text-2xl font-bold mb-6">NFT History - Token #{tokenId}</h1>
            <div className="bg-gray-800 rounded-lg p-4">
                <div className="mb-4">
                    <p>Total Updates: {historyData.total_updates}</p>
                </div>
                <div className="space-y-4">
                    {historyData.history.map((entry) => (
                        <div 
                            key={entry.version}
                            className="border border-gray-700 rounded-lg p-4"
                        >
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="text-lg font-semibold">
                                        Version {entry.version}
                                        {entry.version === historyData.total_updates && 
                                            <span className="ml-2 text-green-500 text-sm">(Current)</span>
                                        }
                                    </h3>
                                    {entry.timestamp !== 'N/A' && (
                                        <p className="text-sm text-gray-400">{entry.timestamp}</p>
                                    )}
                                </div>
                                <button
                                    onClick={() => toggleVersion(entry.version, entry.token_uri)}
                                    className="text-blue-500 hover:text-blue-400"
                                >
                                    {expandedVersions.has(entry.version) ? 'Hide Details' : 'Show Details'}
                                </button>
                            </div>
                            
                            {expandedVersions.has(entry.version) && (
                                <div className="mt-4 text-sm">
                                    <p className="text-gray-400 break-all">
                                        IPFS URI: {entry.token_uri}
                                    </p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default NFTHistory;