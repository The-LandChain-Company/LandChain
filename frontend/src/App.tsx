// src/App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './components/LoginPage';
import DashboardPage from './pages/DashboardPage'; // Import the new page
import { useActiveAccount } from 'thirdweb/react';

// Placeholder content components for nested routes
import DashboardHome from './components/UI/dashboard/content/DashboardHome';
import MyNFTs from './components/UI/dashboard/content/MyNFTs';
import MarketplaceView from './components/UI/dashboard/content/MarketplaceView';
import Settings from './components/UI/dashboard/content/Settings';
import CompleteProfileForm from './components/UI/dashboard/content/CompleteProfileForm'; // Import the form
import MintNFTPage from './components/UI/dashboard/content/MintNFTPage'; // Import the new Mint NFT page
import NFTView from './components/UI/dashboard/content/NFTView'; // Import the NFT view component
import EditNFTPage from './components/UI/dashboard/content/EditNFTPage'; // Import the Edit NFT page
import NFTHistory from './components/UI/dashboard/content/NFTHistory'; // Import the NFT history component

// ProtectedRoute remains the same
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const account = useActiveAccount();
  if (!account) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

function App() {
  return (
    <Router>
      {/* Removed the global nav bar as requested for the dashboard view */}
      {/* You might want a different approach if you need nav on login page */}
      <div className="min-h-screen bg-gray-900"> {/* Ensure base background */}
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/dashboard" // Parent route for dashboard layout
            element={
              <ProtectedRoute>
                <DashboardPage /> {/* Renders the layout (sidebars + content outlet) */}
              </ProtectedRoute>
            }
          >
            {/* Nested Routes - these will render inside DashboardPage's <Outlet /> */}
            <Route index element={<DashboardHome />} /> {/* Default view at /dashboard */}
            <Route path="my-nfts" element={<MyNFTs />} />
            <Route path="mint-nft" element={<MintNFTPage />} /> {/* Add new route for minting */}
            <Route path="marketplace" element={<MarketplaceView />} />
            <Route path="settings" element={<Settings />} />
            {/* Add a route for the profile completion form */}
            <Route path="complete-profile" element={<CompleteProfileForm />} />
            <Route path="my-nfts/:tokenId/view" element={<NFTView />} /> {/* Add route for NFT view */}
            <Route path="my-nfts/:tokenId/edit" element={<EditNFTPage />} /> {/* Add route for editing NFT */}
            <Route path="my-nfts/:tokenId/history" element={<NFTHistory />} /> {/* Add route for NFT history */}
             {/* Add more nested routes as needed */}
          </Route>
          {/* Redirect root to login */}
          <Route path="/" element={<Navigate to="/login" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;