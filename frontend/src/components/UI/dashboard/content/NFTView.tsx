import React, { useEffect, useState, useMemo, lazy, Suspense } from 'react';
import { useParams } from 'react-router-dom';
import LoadingSpinner from '../../LoadingSpinner';

// Lazy-load GoogleMap and MarkerF so they're not part of the initial bundle.
import { MarkerF, useLoadScript } from '@react-google-maps/api';
const LazyGoogleMap = lazy(() =>
    import('@react-google-maps/api').then((module) => ({ default: module.GoogleMap as unknown as React.ComponentType<any> }))
);

interface NFTMetadata {
    title: string;
    description: string;
    image: string;
    external_url: string;
    attributes: {
        trait_type: string;
        value: string;
    }[];
    land_metadata: {
        owner_name: string;
        ownership_doc_url: string;
        user_doc_url: string;
        sale_history_url: string;
        zone_classification: string;
        encumbrances: string;
        tokenization_date: string;
    };
}

const MAP_CONTAINER_STYLE = { width: '100%', height: '300px' };

const ImageModal: React.FC<{ src: string; onClose: () => void }> = ({ src, onClose }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75" onClick={onClose}>
        <img src={src} alt="Full size" className="max-w-[90vw] max-h-[90vh] object-contain" />
    </div>
);

const NFTView: React.FC = () => {
    const { tokenId } = useParams<{ tokenId: string }>();
    const [metadata, setMetadata] = useState<NFTMetadata | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showFullImage, setShowFullImage] = useState(false);

    useEffect(() => {
        const fetchNFTDetails = async () => {
            try {
                const res = await fetch(`/api/nft/${tokenId}`);
                if (!res.ok) throw new Error('Failed to fetch NFT details');
                const data = await res.json();

                const ipfsUri = data.token_uri;
                const cid = ipfsUri.replace('ipfs://', '');
                const metadataRes = await fetch(`https://ipfs.io/ipfs/${cid}`);
                if (!metadataRes.ok) throw new Error('Failed to fetch metadata');
                const metaDataJson = await metadataRes.json();
                setMetadata(metaDataJson);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An error occurred');
            } finally {
                setLoading(false);
            }
        };

        fetchNFTDetails();
    }, [tokenId]);

    // Memoize marker calculation so it's not recalculated on every render.
    const marker = useMemo(() => {
        if (!metadata) return null;
        const geoCoordAttr = metadata.attributes.find(
            (attr) => attr.trait_type === 'Geo Coordinates'
        );
        if (geoCoordAttr) {
            const [lat, lng] = geoCoordAttr.value.split(',').map(Number);
            return { lat, lng };
        }
        return null;
    }, [metadata]);

    const { isLoaded } = useLoadScript({
        googleMapsApiKey: '',
    });

    if (loading)
        return (
            <div className="flex justify-center">
                <LoadingSpinner className="text-white" />
            </div>
        );
    if (error) return <div className="text-red-500">Error: {error}</div>;
    if (!metadata) return <div>No metadata found</div>;

    const handleDocumentClick = (url: string) => {
        const cleanUrl = url.replace('ipfs://', 'https://ipfs.io/ipfs/');
        window.open(cleanUrl, '_blank');
    };

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            <h1 className="text-3xl font-bold mb-6">{metadata.title}</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left column */}
                <div className="space-y-6">
                    <div className="relative">
                        <img
                            src={metadata.image.replace('ipfs://', 'https://ipfs.io/ipfs/')}
                            alt={metadata.title}
                            className="w-full h-[400px] object-cover rounded-lg shadow-lg"
                        />
                        <button
                            onClick={() => setShowFullImage(true)}
                            className="absolute bottom-4 right-4 bg-gray-800 bg-opacity-75 p-2 rounded-full hover:bg-opacity-100 text-black"
                            title="View full size"
                        >
                            <img src="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2018%2018%22%3E%3Cpath%20fill%3D%22%23666%22%20d%3D%22M0%200v6h2V2h4V0H0zm16%200h-4v2h4v4h2V0h-2zm0%2016h-4v2h6v-6h-2v4zM2%2012H0v6h6v-2H2v-4z%22/%3E%3C/svg%3E" alt="" style={{ height: "18px", width: "18px" }}/>
                        </button>
                    </div>
                    {marker && (
                        <div className="bg-gray-800 p-4 rounded-lg">
                            <h2 className="text-xl font-semibold mb-2">Location</h2>
                            {/* Suspense fallback while lazy-loading the map */}
                            <Suspense fallback={<LoadingSpinner className="text-white" />}>
                                {isLoaded ? (
                                    <LazyGoogleMap
                                        mapContainerStyle={MAP_CONTAINER_STYLE}
                                        center={marker}
                                        zoom={15}
                                    >
                                        <MarkerF position={marker} />
                                    </LazyGoogleMap>
                                ) : (
                                    <LoadingSpinner className="text-white" />
                                )}
                            </Suspense>
                        </div>
                    )}
                </div>
                {/* Right column */}
                <div className="space-y-6">
                    <div className="bg-gray-800 p-4 rounded-lg">
                        <h2 className="text-xl font-semibold mb-4">Property Details</h2>
                        <dl className="space-y-2">
                            {metadata.attributes.map((attr) => (
                                <div key={attr.trait_type} className="grid grid-cols-2">
                                    <dt className="text-gray-400">{attr.trait_type}:</dt>
                                    <dd className={attr.trait_type === 'Geo Coordinates' ? 'break-words' : ''}>
                                        {attr.trait_type === 'Geo Coordinates' ? (
                                            <>
                                                {attr.value.split(',').map((coord, index) => (
                                                    <React.Fragment key={index}>
                                                        {coord.trim()}
                                                        {index === 0 && <br />}
                                                    </React.Fragment>
                                                ))}
                                            </>
                                        ) : attr.trait_type === 'Google Maps Location' ? (
                                            <u><a
                                                href={`${attr.value}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-white"
                                            >
                                                Visit
                                            </a></u>
                                        ) : (
                                            attr.value
                                        )}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                    <div className="bg-gray-800 p-4 rounded-lg">
                        <h2 className="text-xl font-semibold mb-4">Documents</h2>
                        <div className="space-y-2">
                            <button
                                onClick={() =>
                                    handleDocumentClick(metadata.land_metadata.ownership_doc_url)
                                }
                                className="w-full text-black px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
                            >
                                View Ownership Document
                            </button>
                            <button
                                onClick={() =>
                                    handleDocumentClick(metadata.land_metadata.encumbrances)
                                }
                                className="w-full text-black px-4 py-2 bg-blue-600 rounded hover:bg-blue-700"
                            >
                                View Encumbrances
                            </button>
                        </div>
                    </div>
<div className="bg-gray-800 p-4 rounded-lg">
                        <h2 className="text-xl font-semibold mb-4">Additional Information</h2>
                        <dl className="space-y-2">
                            <div className="grid grid-cols-2">
                                <dt className="text-gray-400">Owner Name:</dt>
                                <dd>{metadata.land_metadata.owner_name}</dd>
                            </div>
                            <div className="grid grid-cols-2">
                                <dt className="text-gray-400">Tokenization Date:</dt>
                                <dd>{metadata.land_metadata.tokenization_date}</dd>
                            </div>
                            <div className="grid grid-cols-2">
                                <dt className="text-gray-400">Zone Classification:</dt>
                                <dd>{metadata.land_metadata.zone_classification}</dd>
                            </div>
                        </dl>
                    </div>
                </div>
            </div>
            {metadata.land_metadata.user_doc_url && (
    <div className="bg-gray-800 p-4 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Additional Details</h2>
        <iframe
            src={metadata.land_metadata.user_doc_url.replace('ipfs://', 'https://ipfs.io/ipfs/')}
            className="w-full h-[300px] rounded-lg"
            title="Additional Details Document"
        />
    </div>
)}
            {showFullImage && (
                <ImageModal
                    src={metadata.image.replace('ipfs://', 'https://ipfs.io/ipfs/')}
                    onClose={() => setShowFullImage(false)}
                />
            )}
        </div>
    );
};

export default NFTView;