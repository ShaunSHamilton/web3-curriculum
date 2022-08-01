import express from 'express';
import { info, error } from 'logover';
import { deploySmartContract, initialiseBlockchain } from './utils';

info('Starting provider...');

const app = express();

app.use(express.json());
app.use(express.static('../client'));

const _tests = [];

try {
  await init();
} catch (e) {
  error('Unable to initialise blockchain:\n');
  throw new Error(e);
}

app.post('/call-smart-contract', async (req, res) => {
  _tests.push({ body: req.body, url: req.url, headers: req.headers });
  const { id, method, args, address } = req.body;

  if (![id, method, address].filter(Boolean).length === 3) {
    res.status(400).json({
      error: `Missing required fields: id: ${id}, method: ${method}, address: ${address}`
    });
    return;
  }

  try {
    const result = await callSmartContract(id, method, args, address);
    res.json({ result });
  } catch (e) {
    error(e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/get-balance', async (req, res) => {
  _tests.push({ body: req.body, url: req.url, headers: req.headers });
  const { address } = req.body;

  if (!address) {
    res
      .status(400)
      .json({ error: `Missing required fields: address: ${address}` });
    return;
  }

  const balance = await getBalance(address);
  if (!balance) {
    return res.status(404).json({ error: 'Account not found' });
  }
  return res.json({ result: balance });
});

app.post('/transfer', async (req, res) => {
  _tests.push({ body: req.body, url: req.url, headers: req.headers });
  const { from, to, amount } = req.body;

  if ([from, to, amount].filter(Boolean).length !== 3) {
    res.status(400).json({
      error: `Missing required fields: from: ${from}, to: ${to}, amount: ${amount}`
    });
    return;
  }
  await addTransaction(transfer(from, to, amount));
  res.json({ result: 'success' });
});

app.get('/tests', (req, res) => {
  res.json(_tests);
});

app.delete('/tests', (req, res) => {
  _tests.splice(0, _tests.length);
  res.status(200).json({});
});

const PORT = 3001;

app.listen(PORT, () => {
  info(`Provider listening on port ${PORT}`);
});

// ----------------------
// BLOCKCHAIN STUFFS
// ----------------------

await initialiseBlockchain();
await deploySmartContract();