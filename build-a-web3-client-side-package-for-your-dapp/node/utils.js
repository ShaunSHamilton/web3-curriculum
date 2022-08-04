import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { error, info } from 'logover';
import sha256 from 'crypto-js/sha256.js';

export async function writeBlockchain(blockchain) {
  const blockchainString = JSON.stringify(blockchain, null, 2);
  writeFileSync('node/blockchain.json', blockchainString, 'utf8');
}

export async function readBlockchain() {
  const blockchainString = readFileSync('node/blockchain.json', 'utf8');
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
    error(`Smart contract with id '${id}' not found`);
    throw new Error(`Smart contract with id '${id}' not found`);
  } else {
    const smartContract = (await import(contract.pathToPkg)).default;
    const res = smartContract[functionHandle](contract.state, ...functionArgs);
    if (functionHandle.startsWith('set')) {
      contract.state = res;
      await mineBlock({ smartContracts: [contract] });
    }
    return res;
  }
}

export async function mineBlock({ smartContracts = [], accounts = [] }) {
  const blockchain = await readBlockchain();
  const previousBlock = blockchain[blockchain.length - 1];

  const difficulty = 2;

  let hash = '';
  let nonce = 0;
  while (!hash.startsWith('0'.repeat(difficulty))) {
    nonce++;
    hash = sha256(
      nonce +
        previousBlock.hash +
        JSON.stringify(smartContracts) +
        JSON.stringify(accounts)
    ).toString();
  }

  const newBlock = {
    hash,
    previousHash: previousBlock.hash,
    nonce,
    smartContracts,
    accounts
  };

  blockchain.push(newBlock);
  await writeBlockchain(blockchain);
}

export async function deploySmartContract() {
  const relPathToPkg = 'node/pkg/build_a_smart_contract_in_rust.js';

  try {
    const pathToPkg = join('..', relPathToPkg);
    const pkg = (await import(pathToPkg)).default;
    const initialised = pkg.initialise();
    const smartContract = {
      pathToPkg,
      state: initialised,
      id: 0
    };
    await mineBlock({ smartContracts: [smartContract] });
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
    smartContracts: [],
    accounts: [
      {
        address: 'program_account',
        balance: 1_000_000_000
      },
      {
        address: 'shaun',
        balance: 1_000
      },
      {
        address: 'tom',
        balance: 1_000
      }
    ]
  };

  const blockchain = [genesisBlock];
  await writeBlockchain(blockchain);
}

export async function transfer({ from, to, amount }) {
  const fromAccount = await getAccount(from);
  const toAccount = await getAccount(to);
  if (!fromAccount || !toAccount) {
    error(`Accounts not found: ${from} and ${to}`);
    throw new Error(`Accounts not found: ${from} and ${to}`);
  }
  if (fromAccount.balance < amount) {
    warn(
      `'${fromAccount.address}' has insufficient funds: ${fromAccount.balance} < ${amount}`
    );
  }
  fromAccount.balance -= amount;
  toAccount.balance += amount;
  await mineBlock({ accounts: [fromAccount, toAccount] });
}

export async function getAccount(address) {
  const blockchain = await readBlockchain();
  let account = null;
  for (const block of blockchain.reverse()) {
    for (const account of block.accounts) {
      if (account.address === address) {
        return account;
      }
    }
  }
  return account;
}
