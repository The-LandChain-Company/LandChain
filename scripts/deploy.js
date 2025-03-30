async function main() {
    // Get the deployer account
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with:", deployer.address);
  
    // Deploy NFTLand contract
    const NFTLand = await ethers.getContractFactory("NFTLand");
    const nftLand = await NFTLand.deploy();
    await nftLand.deployed();
    console.log("NFTLand deployed to:", nftLand.address);
  
    // Deploy ActionLogger contract
    const ActionLogger = await ethers.getContractFactory("ActionLogger");
    const actionLogger = await ActionLogger.deploy();
    await actionLogger.deployed();
    console.log("ActionLogger deployed to:", actionLogger.address);
  }
  
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
  