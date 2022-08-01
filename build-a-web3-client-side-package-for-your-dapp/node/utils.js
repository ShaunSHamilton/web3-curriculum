import { writeFile, readFile } from 'fs/promises';
import { error } from 'logover';
import sha256 from 'crypto-js/sha256.js';

export async function writeBlockchain(blockchain) {
  const blockchainString = JSON.stringify(blockchain, null, 2);
  await writeFile('node/data/blockchain.json', blockchainString);
}

export async function readBlockchain() {
  const blockchainString = await readFile('node/data/blockchain.json');
  return JSON.parse(blockchainString);
}

export async function getSmartContract(id) {
  const blockchain = await readBlockchain();
  for (const block of blockchain.reverse()) {
    for (const smartContract of block.smartContracts) {
      if (smartContract.id === id) {
        return smartContract;
      }
    }
  }
  return null;
}

export async function callSmartContract(id, functionHandle, functionArgs) {
  const contract = await getSmartContract(id);

  if (!contract) {
    error(`Smart contract with id ${id} not found`);
    process.exit(1);
  } else {
    const smartContract = (await import(contract.pathToPkg)).default;
    const res = smartContract[functionHandle](contract.state, ...functionArgs);
    contract.state = res;
    await mineBlock([contract]);
  }
}

export async function mineBlock(smartContracts) {
  const blockchain = await readBlockchain();
  const previousBlock = blockchain[blockchain.length - 1];

  const difficulty = 2;

  let hash = '';
  let nonce = 0;
  while (!hash.startsWith('0'.repeat(difficulty))) {
    nonce++;
    hash = sha256(
      nonce + previousBlock.hash + JSON.stringify(smartContracts)
    ).toString();
  }

  const newBlock = {
    hash,
    previousHash: previousBlock.hash,
    nonce,
    smartContracts
  };

  blockchain.push(newBlock);
  await writeBlockchain(blockchain);
}

export async function deploySmartContract() {
  const relPathToPkg = './smart-contract/pkg';

  try {
    const pathToPkg = join('..', relPathToPkg);
    const pkg = (await import(pathToPkg)).default;
    const initialised = pkg.initialise();
    const smartContract = {
      pathToPkg,
      state: initialised,
      id: 0
    };
    await mineBlock([smartContract]);
    info(`Smart contract deployed with id: ${smartContract.id}`);
  } catch (e) {
    error('Unable to deploy smart contract: ');
    throw new Error(e);
  }
}

export async function initialiseBlockchain() {
  const genesisBlock = {
    hash: 0,
    previousHash: null,
    smartContracts: []
  };

  const blockchain = [genesisBlock];
  await writeBlockchain(blockchain);
}