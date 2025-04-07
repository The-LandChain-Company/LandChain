// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract NFTLand is ERC721URIStorage, Ownable {
    uint256 public tokenCounter;
    // Mapping from tokenId to encrypted metadata (for genesis tokens)
    mapping(uint256 => string) public tokenData;
    // Mapping for updates: genesis tokenId => list of update records (encrypted data)
    mapping(uint256 => string[]) public tokenUpdates;

    event NFTMinted(uint256 tokenId, address owner, string data);
    event NFTUpdated(uint256 genesisTokenId, uint256 updateIndex, string updatedData);

    constructor() ERC721("LandChain", "LAND") Ownable(msg.sender) {
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
    function updateNFT(uint256 tokenId, string memory updatedEncryptedData) public {
        require(ownerOf(tokenId) == msg.sender, "Only owner can update");
        tokenUpdates[tokenId].push(updatedEncryptedData);
        tokenData[tokenId] = updatedEncryptedData;
        _setTokenURI(tokenId, updatedEncryptedData);
        emit NFTUpdated(tokenId, tokenUpdates[tokenId].length - 1, updatedEncryptedData);
    }

    function getUpdateCount(uint256 tokenId) public view returns (uint256) {
        return tokenUpdates[tokenId].length;
    }

}
