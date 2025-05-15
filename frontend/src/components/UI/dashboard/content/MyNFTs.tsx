// src/components/dashboard/content/MyNFTs.tsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import LoadingSpinner from '../../LoadingSpinner';

interface NFT {
  tokenId: string;
  tokenURI: string;
  title: string;
  timestamp: string;
}

const MyNFTs: React.FC = () => {
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNFTsWithMetadata = async () => {
    try {
      const res = await fetch('/api/nft/my_nfts');
      if (!res.ok) {
        throw new Error(`Alchemy error: ${res.status}`);
      }
      const json = await res.json();
      const owned = json.nfts;

      // Launch all metadata fetches concurrently
      const metadataPromises = owned.map((item: any) => {
        const ipfsUri = item.tokenURI;
        const cid = ipfsUri.replace('ipfs://', '');
        const metadataUrl = `https://ipfs.io/ipfs/${cid}`;
        return fetch(metadataUrl)
          .then((metadataRes) => {
            if (!metadataRes.ok) {
              throw new Error(`Failed to fetch metadata: ${metadataRes.status}`);
            }
            return metadataRes.json();
          })
          .catch((err) => {
            console.error('Metadata fetch error for', ipfsUri, err);
            return null;
          });
      });

      const metadataArr = await Promise.all(metadataPromises);

      const simplified: NFT[] = owned.map((item: any, index: number) => {
        const metadata = metadataArr[index];
        return {
          tokenId: item.tokenID,
          tokenURI: item.tokenURI,
          title: metadata?.title || 'Unknown Title',
          timestamp: metadata?.land_metadata?.tokenization_date || 'Unknown Date',
        };
      });

      setNfts(simplified);
      setError(null);
    } catch (err: any) {
      throw err;
    }
  };

  useEffect(() => {
    const attemptFetch = async () => {
      try {
        await fetchNFTsWithMetadata();
      } catch (err: any) {
        console.log("First attempt failed, retrying in 2 seconds...");
        // Wait for 2 seconds
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        try {
          // Second attempt
          await fetchNFTsWithMetadata();
        } catch (retryErr: any) {
          // Only set error if both attempts fail
          setError(retryErr.message);
        }
      } finally {
        setLoading(false);
      }
    };

    attemptFetch();
  }, []);

  if (loading) return (
  <div>
    <div className="flex justify-between items-center mb-4">
      <h2 className="text-2xl font-semibold">My NFTs</h2>
      <Link to="/dashboard/mint-nft">
        <button className="bg-blue-500 hover:bg-blue-700 text-black font-bold py-2 px-4 rounded">
          Mint New NFT
        </button>
      </Link>
    </div>
    <div className="flex items-center">
      <LoadingSpinner className="text-white" />
      <span className="ml-2 text-white">Loading...</span>
    </div>
  </div>);
  if (error) return <p className="text-red-500">Error: {error}</p>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold">My NFTs</h2>
        <Link to="/dashboard/mint-nft">
          <button className="bg-blue-500 hover:bg-blue-700 text-black font-bold py-2 px-4 rounded">
            Mint New NFT
          </button>
        </Link>
      </div>
      {nfts.length > 0 ? (
        <table className="table-auto w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-4 py-2 text-black">Token ID</th>
              <th className="border px-4 py-2 text-black">Name</th>
              <th className="border px-4 py-2 text-black">Date</th>
              <th className="border px-4 py-2 text-black">Actions</th>
            </tr>
          </thead>
          <tbody>
            {nfts.map((nft) => (
              <tr key={`${nft.tokenId}`} className="text-center">
                <td className="border px-1 py-2 text-sm">{nft.tokenId}</td>
                <td className="border px-4 py-2">{nft.title}</td>
                <td className="border px-4 py-2">{nft.timestamp}</td>
                <td className="border px-1 py-2">
                    <Link to={`/dashboard/my-nfts/${nft.tokenId}/edit`}>
                        <button className="text-black mr-2">Edit</button>
                    </Link>
                    <Link to={`/dashboard/my-nfts/${nft.tokenId}/view`}>
                        <button className="text-black mr-2">View</button>
                    </Link>
                    <Link to={`/dashboard/my-nfts/${nft.tokenId}/history`}>
                        <button className="text-black">History</button>
                    </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No NFTs found.</p>
      )}
    </div>
  );
};

export default MyNFTs;