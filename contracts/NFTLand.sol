// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract NFTLand is ERC721, Ownable {
    uint256 public tokenCounter;
    // Mapping from tokenId to encrypted metadata (for genesis tokens)
    mapping(uint256 => string) public tokenData;
    // Mapping for updates: genesis tokenId => list of update records (encrypted data)
    mapping(uint256 => string[]) public tokenUpdates;

    event NFTMinted(uint256 tokenId, address owner, string data);
    event NFTUpdated(uint256 genesisTokenId, uint256 updateIndex, string updatedData);

    constructor() ERC721("LandRecord", "LAND") Ownable(msg.sender) {
    tokenCounter = 0;
}


    // Mint a new NFT (genesis land record)
    function mintNFT(string memory encryptedData) public returns (uint256) {
        uint256 newTokenId = tokenCounter;
        _safeMint(msg.sender, newTokenId);
        tokenData[newTokenId] = encryptedData;
        tokenCounter++;
        emit NFTMinted(newTokenId, msg.sender, encryptedData);
        return newTokenId;
    }

    // Append an update to an existing NFT (does not change the original token)
    function updateNFT(uint256 genesisTokenId, string memory updatedEncryptedData) public {
        require(ownerOf(genesisTokenId) == msg.sender, "Only owner can update");
        tokenUpdates[genesisTokenId].push(updatedEncryptedData);
        uint256 updateIndex = tokenUpdates[genesisTokenId].length - 1;
        emit NFTUpdated(genesisTokenId, updateIndex, updatedEncryptedData);
    }
}
