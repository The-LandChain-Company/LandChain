import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import axios from 'axios';
import ReactQuill, { Quill } from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
const ReactQuillComponent = ReactQuill as unknown as React.FC<any>;
import { useActiveAccount, useActiveWallet } from 'thirdweb/react';
import { MarkerF, useLoadScript } from '@react-google-maps/api';
import LoadingSpinner from '../../LoadingSpinner';

// Lazy load the Google Map component
const LazyGoogleMap = lazy(() =>
    import('@react-google-maps/api').then((module) => ({ 
        default: module.GoogleMap as unknown as React.ComponentType<any> 
    }))
);
import { useDashboardContext } from '../../../../pages/DashboardPage';
import { useNavigate } from 'react-router-dom';            // ✅ add
import { client } from '../../../../lib/thirdweb';
import NFTLandABI  from '../../../../abi/NFTLand.json';
import { defineChain } from 'thirdweb/chains';
import { getContract } from "thirdweb";
const polygonAmoy = defineChain(80002);

// ⬆ existing imports …
import { prepareContractCall, sendTransaction } from 'thirdweb';   // ✅ add
// 🔁  add this next to your other thirdweb imports
import { waitForReceipt } from "thirdweb";

// Put your deployed contract address once here
const CONTRACT_ADDRESS = '0xB0097c317C29143A0BdF576DF352829FbBa56ecb';  // ← change me

// add a PDF icon
const icons = Quill.import('ui/icons') as any;
icons['pdf'] = `
  <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="none" d="M0 0h24v24H0z"></path><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z"></path></svg>
`;

const formats = [
  'header','bold','italic','underline',
  'link','blockquote','code-block',
  'list','bullet',
  'image','video','pdf'
];

// common upload helper
async function uploadToPinata(file: File) {
  const form = new FormData();
  form.append('file', file);
  const res = await axios.post('/api/ipfs/file', form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });

  const hash = res.data;
  // pick whatever gateway you prefer
  return `https://gateway.pinata.cloud/ipfs/${hash}`;
}

async function imageHandler(this: any) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.click();
  input.onchange = async () => {
    const url = await uploadToPinata(input.files![0]);
    const range = this.quill.getSelection();
    this.quill.insertEmbed(range.index, 'image', url);
    this.quill.setSelection(range.index + 1);
  };
}

async function videoHandler(this: any) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'video/*';
  input.click();
  input.onchange = async () => {
    const url = await uploadToPinata(input.files![0]);
    const range = this.quill.getSelection();
    this.quill.insertEmbed(range.index, 'video', url);
    this.quill.setSelection(range.index + 1);
  };
}

async function pdfHandler(this: any) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/pdf';
  input.click();
  input.onchange = async () => {
    const file = input.files![0];
    const url = await uploadToPinata(file);
    const fileName = file.name;                   // ← use actual filename
    const range = this.quill.getSelection();
    this.quill.insertText(range.index, fileName, { link: url });
    this.quill.setSelection(range.index + fileName.length);
  };
}

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
      image: imageHandler,
      video: videoHandler,
      pdf: pdfHandler
    }
  }
};


const MAP_CONTAINER_STYLE = { width: '100%', height: '300px' };
const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 };

const MintNFTPage: React.FC = () => {
  const account = useActiveAccount();
  const activeWallet = useActiveWallet();
  const { profile, refreshProfile } = useDashboardContext();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    address: '',                     // ← new
    size: '',
    landUse: '',
    zoneClassification: '',          // ← new, right after landUse
    ownershipVerified: 'Yes',
    surveyNumber: '',
    plotId: '',
    // auto-filled:
    tokenizationDate: new Date().toISOString().split('T')[0],
    ownerName: '',
    minterAddress: account?.address || '',
    googleMapsLocation: '',
    geoCoordinates: '',

    externalUrl: 'https://app.landchain.in/nft/tokenId',
    saleHistoryUrl: 'https://app.landchain.in/nft/tokenId/history',
    price: '10000',
    // rich text
    userDocHtmlContent:
      '<p>Enter additional details here. You can use <b>HTML</b> tags. Remember to remove this first.</p>',
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [ownershipDocFile, setOwnershipDocFile] = useState<File | null>(null);
  const [encumbranceFile, setEncumbranceFile] = useState<File | null>(null);
  const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // 1) Auto‐fill ownerName when account connects
  useEffect(() => {
    if (account?.address && profile?.name) {
          setFormData((f) => ({ ...f, ownerName: profile.name || '' }));
        }
  }, [account, profile]);

  // helper to handle text inputs
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((f) => ({ ...f, [name]: value }));
  };

  // handle map clicks
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

// keep your NFTLandABI import and CONTRACT_ADDRESS

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
    if (!imageFile || !ownershipDocFile || !account || !activeWallet) {
      setStatusMessage(
        'Please upload both image & ownership doc and connect your wallet.',
      );
      return;
    }
    setStatusMessage('Uploading metadata & files to IPFS…');

    // 1) Upload to IPFS / prepare metadata
    const form = new FormData();
    // … append all your formData fields …
    // file fields
    if (imageFile) {
      form.append('image', imageFile);
    }
    
    if (ownershipDocFile) {
      form.append('ownership_document', ownershipDocFile);
    }
    
    if (encumbranceFile) {
      form.append('encumbrances', encumbranceFile);
    }

    // simple text fields
    form.append('title', formData.title);
    form.append('description', formData.description);
    form.append('address', formData.address);
    form.append('size', formData.size);
    form.append('land_use', formData.landUse);
    form.append('zone_classification', formData.zoneClassification);
    form.append('ownership_verified', formData.ownershipVerified);
    form.append('survey_number', formData.surveyNumber);
    form.append('plot_id', formData.plotId);
    form.append('owner_name', formData.ownerName);
    form.append('minter_address', formData.minterAddress);
    form.append('google_maps_location', formData.googleMapsLocation);
    form.append('geo_coordinates', formData.geoCoordinates);
    form.append('tokenization_date', formData.tokenizationDate);

    // Additional choice fields
    form.append('user_doc_html_content', formData.userDocHtmlContent);

    // off chain connections
    form.append('external_url', formData.externalUrl);
    form.append('sale_history_url', formData.saleHistoryUrl);

    const metaRes = await fetch('/api/nft/prepare_metadata_for_minting', {
      method: 'POST',
      body: form,
    });
    if (!metaRes.ok) throw new Error('Metadata prep failed');
    const { token_uri: tokenURI } = await metaRes.json();

    // -------------------- unchanged validation / IPFS upload -----------------
    // (everything until you obtain `tokenURI` can stay exactly as it was)
    // ------------------------------------------------------------------------

    // ------------------------------------------------------------------------
    setStatusMessage('Preparing on-chain mint…');

    // ------------------------------------------------------------------------
    // 2️⃣  Send the tx with whichever wallet the user connected
    // ------------------------------------------------------------------------


    if (!activeWallet) {
        setStatusMessage('No wallet connected.');
        return;
    }

    try {
        setStatusMessage('Preparing transaction…');

        // 1️⃣ Build a transaction object the way Thirdweb expects
        const transaction = prepareContractCall({
          contract: getContract({
            address: CONTRACT_ADDRESS,
            abi: NFTLandABI as any,
            chain: polygonAmoy,
            client,                 // ← the client you already created in lib/thirdweb
          }),
          method: 'function mintNFT(string data)', // or 'mint(address,string)' if that’s your signature
          params: [tokenURI],        // add recipient address as first param if needed
    });

// 1. Send the transaction
const hash = await sendTransaction({
  transaction,
  account,           // activeAccount from `useActiveAccount`
});

setStatusMessage("Waiting for on-chain confirmation…");

// 2. Wait until it is mined
const receipt = await waitForReceipt({ client, chain: polygonAmoy, transactionHash: hash.transactionHash});

// 3. Update UI / backend
if (receipt.status === "success") {
  setStatusMessage(`Minted! Tx hash: ${hash.transactionHash}`);
  // Refresh the dashboard if necessary (optional)
  refreshProfile();
  // Navigate to the dashboard/myNfts page
  navigate('/dashboard/mynfts');
}
} catch (err: any) {
        console.error(err);
        setStatusMessage(`Mint failed: ${err.message || err}`);
    }
};

const { isLoaded } = useLoadScript({
        googleMapsApiKey: '',
    });

  return (
    <form onSubmit={handleSubmit}>
      {/* … your existing form inputs, map, file selectors … */}

      <div className="p-4 max-w-2xl mx-auto bg-gray-800 text-white rounded">
        <h2 className="text-2xl mb-4 text-center">Mint New Land NFT</h2>
        <div className="space-y-4">

          {/* Basic fields */}
          <div>
            <label className="block text-sm">Title</label>
            <input
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              required
              className="input-field"
            />
          </div>

          <div>
            <label>Address</label>
            <input
              name="address"
              value={formData.address}
              onChange={handleChange}
              required
              className="input-field"
            />
          </div>


          {/* file uploads */}
          <div>
            <label className="block text-sm">Image</label>
            <input
              type="file"
              name="imageFile"
              accept="image/*,application/pdf"
              onChange={handleFileChange}
              required
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm">Ownership Document (PDF)</label>
            <input
              type="file"
              name="ownershipDocFile"
              accept="application/pdf"
              onChange={handleFileChange}
              required
              className="input-field"
            />
          </div>
          <div>
            <label>Encumbrance Certificate (PDF)</label>
            <input
              type="file"
              name="encumbranceFile"
              accept="application/pdf"
              onChange={handleFileChange}
              required
              className="input-field"
            />
          </div>

          {/* Attributes */}
          <h3 className="pt-4 border-t border-gray-700">Attributes</h3>
          <div>
            <label>Size</label>
            <input
              name="size"
              value={formData.size}
              onChange={handleChange}
              className="input-field"
            />
          </div>

          <div>
            <label>Land Use</label>
            <input
              name="landUse"
              value={formData.landUse}
              onChange={handleChange}
              className="input-field"
            />
          </div>
          <div>
            <label>Zone Classification</label>
            <input
              name="zoneClassification"
              value={formData.zoneClassification}
              onChange={handleChange}
              required
              className="input-field"
            />
          </div>

          <div>
            <label>Survey Number</label>
            <input
              name="surveyNumber"
              value={formData.surveyNumber}
              onChange={handleChange}
              className="input-field"
            />
          </div>
          <div>
            <label>Plot ID (ULPIN)</label>
            <input
              name="plotId"
              value={formData.plotId}
              onChange={handleChange}
              className="input-field"
            />
          </div>

          {/* GOOGLE MAP */}
          <div>
            <label className="block text-sm mb-1">
              Pick Location on Map
            </label>
              <Suspense fallback={<LoadingSpinner />}>
              {isLoaded ? (
                <LazyGoogleMap
                  mapContainerStyle={MAP_CONTAINER_STYLE}
                  center={marker || DEFAULT_CENTER}
                  zoom={marker ? 15 : 5}
                  onClick={onMapClick}
                >
                  {marker && <MarkerF position={marker} />}
              </LazyGoogleMap>
              ) : (
                  <LoadingSpinner className="text-white" />
              )}
            </Suspense>
            {marker && (
              <p className="mt-2 text-xs text-gray-300">
                Coordinates: {formData.geoCoordinates} <br />
                Link: {formData.googleMapsLocation}
              </p>
            )}
          </div>

          {/* Rich‐text HTML editor for userDocHtmlContent */}
          <div>
            <ReactQuillComponent
              className="ql-container ql-snow bg-white text-black"
              theme="snow"
              value={formData.userDocHtmlContent}
              onChange={(html: string) => setFormData(f => ({ ...f, userDocHtmlContent: html }))}
              modules={modules}
              formats={formats}
            />
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-indigo-600 rounded hover:bg-indigo-500 input-field"
          >
            Mint NFT
          </button>
          {statusMessage && <p className="mt-2 text-center">{statusMessage}</p>}
        </div>
      </div>
    </form>
  );
};

export default MintNFTPage;