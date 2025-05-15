import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
const ReactQuillComponent = ReactQuill as unknown as React.FC<any>;
import { useActiveAccount, useActiveWallet } from 'thirdweb/react';
import { GoogleMap, MarkerF, useLoadScript } from '@react-google-maps/api';
const WrappedGoogleMap = GoogleMap as unknown as React.FC<any>;
import { client } from '../../../../lib/thirdweb';
import NFTLandABI from '../../../../abi/NFTLand.json';
import { defineChain } from 'thirdweb/chains';
import { getContract } from "thirdweb";
import { prepareContractCall, sendTransaction, waitForReceipt } from 'thirdweb';
import LoadingSpinner from '../../LoadingSpinner';

const polygonAmoy = defineChain(80002);
const CONTRACT_ADDRESS = '0xB0097c317C29143A0BdF576DF352829FbBa56ecb';

// Reuse the same modules and formats from MintNFTPage
const formats = [
  'header','bold','italic','underline',
  'link','blockquote','code-block',
  'list','bullet',
  'image','video','pdf'
];


// Reuse the same modules configuration
const modules = {
  toolbar: {
    container: [
      [{ header: [1, 2, false] }],
      ['bold','italic','underline'],
      ['link','blockquote','code-block'],
      [{ list: 'ordered' },{ list: 'bullet' }],
      ['image','video','pdf'],
      ['clean']
    ],
    handlers: {
      // Add handlers if needed
    }
  }
};

const MAP_CONTAINER_STYLE = { width: '100%', height: '300px' };
const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 };

const EditNFTPage: React.FC = () => {
  const { tokenId } = useParams<{ tokenId: string }>();
  const navigate = useNavigate();
  const account = useActiveAccount();
  const activeWallet = useActiveWallet();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    address: '',
    size: '',
    landUse: '',
    zoneClassification: '',
    ownershipVerified: 'Yes',
    surveyNumber: '',
    plotId: '',
    tokenizationDate: '',
    ownerName: '',
    minterAddress: '',
    googleMapsLocation: '',
    geoCoordinates: '',
    externalUrl: '',
    saleHistoryUrl: '',
    userDocHtmlContent: '',
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [ownershipDocFile, setOwnershipDocFile] = useState<File | null>(null);
  const [encumbranceFile, setEncumbranceFile] = useState<File | null>(null);
  const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string>('');
  const [showFullImage, setShowFullImage] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const [metadata, setMetadata] = useState<any>(null);

  const { isLoaded: mapLoaded } = useLoadScript({
    googleMapsApiKey: '',
  });

  // Fetch existing NFT data
  useEffect(() => {
    const fetchNFTData = async () => {
      try {
        const res = await fetch(`/api/nft/${tokenId}`);
        if (!res.ok) throw new Error('Failed to fetch NFT details');
        
        const data = await res.json();
        const ipfsUri = data.token_uri;
        const cid = ipfsUri.replace('ipfs://', '');
        const metadataRes = await fetch(`https://ipfs.io/ipfs/${cid}`);
        if (!metadataRes.ok) throw new Error('Failed to fetch metadata');
        const metadata = await metadataRes.json();
        
        // Set the current image URL
        setCurrentImageUrl(metadata.image.replace('ipfs://', 'https://ipfs.io/ipfs/'));
        setMetadata(metadata);
        setCurrentImageUrl(metadata.image.replace('ipfs://', 'https://ipfs.io/ipfs/'));
        
        // Parse coordinates if they exist
        if (metadata.attributes) {
          const geoCoords = metadata.attributes.find(
            (attr: any) => attr.trait_type === 'Geo Coordinates'
          )?.value;
          if (geoCoords) {
            const [lat, lng] = geoCoords.split(',').map(Number);
            setMarker({ lat, lng });
          }
        }

        // Update form data with existing values
        setFormData({
          title: metadata.title || '',
          description: metadata.description || '',
          address: metadata.attributes?.find((attr: any) => attr.trait_type === 'Address')?.value || '',
          size: metadata.attributes?.find((attr: any) => attr.trait_type === 'Size')?.value || '',
          landUse: metadata.attributes?.find((attr: any) => attr.trait_type === 'Land Use')?.value || '',
          zoneClassification: metadata.land_metadata?.zone_classification || '',
          ownershipVerified: metadata.attributes?.find((attr: any) => attr.trait_type === 'Ownership Verified')?.value || 'Yes',
          surveyNumber: metadata.attributes?.find((attr: any) => attr.trait_type === 'Survey Number')?.value || '',
          plotId: metadata.attributes?.find((attr: any) => attr.trait_type === 'Plot ID')?.value || '',
          tokenizationDate: metadata.land_metadata?.tokenization_date || '',
          ownerName: metadata.land_metadata?.owner_name || '',
          minterAddress: account?.address || '',
          googleMapsLocation: metadata.attributes?.find((attr: any) => attr.trait_type === 'Google Maps Location')?.value || '',
          geoCoordinates: metadata.attributes?.find((attr: any) => attr.trait_type === 'Geo Coordinates')?.value || '',
          externalUrl: metadata.external_url || '',
          saleHistoryUrl: metadata.land_metadata?.sale_history_url || '',
          userDocHtmlContent: metadata.land_metadata?.user_doc_url ? 
            await fetch(metadata.land_metadata.user_doc_url.replace('ipfs://', 'https://ipfs.io/ipfs/')).then(r => r.text()) : '',
        });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (tokenId) {
      fetchNFTData();
    }
  }, [tokenId, account?.address]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((f) => ({ ...f, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (e.target.name === 'imageFile') {
      setImageFile(file);
    } else if (e.target.name === 'ownershipDocFile') {
      setOwnershipDocFile(file);
    } else if (e.target.name === 'encumbranceFile') {
      setEncumbranceFile(file);
    }
  };

  const onMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setMarker({ lat, lng });
      const mapsLink = `https://maps.app.goo.gl/?q=${lat},${lng}`;
      setFormData((f) => ({
        ...f,
        googleMapsLocation: mapsLink,
        geoCoordinates: `${lat},${lng}`,
      }));
    },
    [setFormData],
  );

  // Add this helper function at the top of the file after imports
  const camelToSnakeCase = (str: string): string => {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  };

  // Update the handleSubmit function
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account || !activeWallet) {
      setStatusMessage('Please connect your wallet.');
      return;
    }

    try {
      setStatusMessage('Uploading updated metadata & files to IPFS…');
      const form = new FormData();

      // Convert camelCase to snake_case when appending form fields
      Object.entries(formData).forEach(([key, value]) => {
        const snakeCaseKey = camelToSnakeCase(key);
        form.append(snakeCaseKey, value);
      });

      // Add existing IPFS URLs
      form.append('existing_image_url', currentImageUrl.replace('https://ipfs.io/ipfs/', 'ipfs://'));
      form.append('existing_ownership_doc_url', metadata?.land_metadata?.ownership_doc_url || '');
      form.append('existing_encumbrances_url', metadata?.land_metadata?.encumbrances || '');

      // Optional file uploads
      if (imageFile) form.append('image', imageFile);
      if (ownershipDocFile) form.append('ownership_document', ownershipDocFile);
      if (encumbranceFile) form.append('encumbrances', encumbranceFile);

      const metaRes = await fetch('/api/nft/prepare_metadata_for_update', {
        method: 'POST',
        body: form,
      });

      if (!metaRes.ok) throw new Error('Metadata prep failed');
      const { token_uri: tokenURI } = await metaRes.json();

      setStatusMessage('Preparing transaction…');

      const transaction = prepareContractCall({
        contract: getContract({
          address: CONTRACT_ADDRESS,
          abi: NFTLandABI as any,
          chain: polygonAmoy,
          client,
        }),
        method: 'function updateNFT(uint256 tokenId, string updatedData)',
        params: [BigInt(tokenId!), tokenURI],
      });

      const hash = await sendTransaction({
        transaction,
        account,
      });

      setStatusMessage('Waiting for confirmation...');

      const receipt = await waitForReceipt({
        client,
        chain: polygonAmoy,
        transactionHash: hash.transactionHash
      });

      if (receipt.status === "success") {
        setStatusMessage('NFT updated successfully!');
        navigate(`/dashboard/my-nfts/${tokenId}/view`);
      }
    } catch (err: any) {
      console.error(err);
      setStatusMessage(`Update failed: ${err.message || err}`);
    }
  };

  if (loading) return <div className="flex justify-center"><LoadingSpinner className="text-white" /></div>;
  if (error) return <div className="text-red-500">Error: {error}</div>;

  // Add this new component at the top level of the file
  const ImageModal = ({ src, onClose }: { src: string; onClose: () => void }) => (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="max-w-4xl max-h-[90vh] overflow-auto">
        <img
          src={src}
          alt="Full size"
          className="w-full h-auto"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit}>
      <div className="p-4 max-w-2xl mx-auto bg-gray-800 text-white rounded">
        <h2 className="text-2xl mb-4 text-center">Edit Land NFT #{tokenId}</h2>
        <div className="space-y-4">
          {/* Current Image Display */}
          {currentImageUrl && (
            <div className="bg-gray-800 p-4 rounded-lg">
              <div className="relative">
                <div className="w-full pt-[56.25%]"> {/* 16:9 Aspect Ratio */}
                  <img
                    ref={imageRef}
                    src={currentImageUrl}
                    alt="Current NFT"
                    className="absolute top-0 left-0 w-full h-full object-cover cursor-pointer rounded-lg"
                    onClick={() => setShowFullImage(true)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Image Modal */}
          {showFullImage && (
            <ImageModal
              src={currentImageUrl}
              onClose={() => setShowFullImage(false)}
            />
          )}

          {/* Basic Information */}
          <div>
            <div>
              <label>New Image (optional)</label>
              <input
                type="file"
                name="imageFile"
                accept="image/*"
                onChange={handleFileChange}
                className="input-field"
              />
            </div>

            <div>
              <label>Title</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                className="input-field"
                required
              />
            </div>

            <div>
              <label>Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="input-field"
                required
              />
            </div>
          </div>

          {/* Property Details */}
          <div>
            <div>
              <label>Address</label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="input-field"
                required
              />
            </div>

            <div>
              <label>Size</label>
              <input
                type="text"
                name="size"
                value={formData.size}
                onChange={handleChange}
                className="input-field"
                required
              />
            </div>

            <div>
              <label>Land Use</label>
              <input
                type="text"
                name="landUse"
                value={formData.landUse}
                onChange={handleChange}
                className="input-field"
                required
              />
            </div>

            <div>
              <label>Zone Classification</label>
              <input
                type="text"
                name="zoneClassification"
                value={formData.zoneClassification}
                onChange={handleChange}
                className="input-field"
                required
              />
            </div>

            <div>
              <label>Survey Number</label>
              <input
                type="text"
                name="surveyNumber"
                value={formData.surveyNumber}
                onChange={handleChange}
                className="input-field"
                required
              />
            </div>
          </div>

          {/* Documents */}
          <div>
            <div>
              <label>New Ownership Document (optional)</label>
              <input
                type="file"
                name="ownershipDocFile"
                onChange={handleFileChange}
                className="input-field"
              />
            </div>

            <div>
              <label>New Encumbrance Certificate (optional)</label>
              <input
                type="file"
                name="encumbranceFile"
                onChange={handleFileChange}
                className="input-field"
              />
            </div>
          </div>

          {/* Map Location */}
          {mapLoaded && (
            <div>
              <WrappedGoogleMap
                mapContainerStyle={MAP_CONTAINER_STYLE}
                center={marker || DEFAULT_CENTER}
                zoom={15}
                onClick={onMapClick}
              >
                {marker && <MarkerF position={marker} />}
              </WrappedGoogleMap>
            </div>
          )}

          {/* Additional Details */}
          <div>
            <label>Additional Information</label>
            <ReactQuillComponent
              value={formData.userDocHtmlContent}
              className="ql-container ql-snow bg-white text-black"
              theme="snow"
              onChange={(content: string) =>
                setFormData((f) => ({ ...f, userDocHtmlContent: content }))
              }
              modules={modules}
              formats={formats}
            />
          </div>

          {/* Submit Button */}
          <button type="submit" className="input-field">
            Update NFT
          </button>

          {statusMessage && (
            <div>
              {statusMessage}
            </div>
          )}
        </div>
      </div>
    </form>
  );
};

export default EditNFTPage;