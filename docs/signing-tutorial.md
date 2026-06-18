# Tutorial: Building and Signing a Stellar Transaction

This tutorial walks you through the complete flow of constructing a `TransactionEnvelope`, attaching a keypair signature, and submitting it using **sharif-soroban-tools**. It covers both a standard transaction and the more advanced fee bump pattern.

---

## Prerequisites

- Node.js 20+
- Dependencies installed: `npm install`
- Basic familiarity with TypeScript

---

## Concepts

Before writing any code, here are the three building blocks this library works with:

| Type | Description |
|------|-------------|
| `Transaction` | The core payload: source account, fee, sequence number, operations, and signatures |
| `TransactionEnvelope` | A wrapper around a `Transaction` with `type: 'transaction'` |
| `FeeBumpTransactionEnvelope` | Wraps an inner `Transaction` inside a fee bump, allowing a third party to pay the fee |
| `Signature` | A `{ hint, signature }` pair — the hint identifies the keypair, the signature is the cryptographic proof |

---

## Step 1 — Import the library

Everything you need lives in `src/core/transaction.ts` and `src/core/engine.ts`.

```typescript
import {
  Transaction,
  TransactionEnvelope,
  Signature,
  StellarEnvelope,
} from './src/core/transaction';

import { CoreEngine } from './src/core/engine';
```

---

## Step 2 — Initialise a keypair

sharif-soroban-tools works with raw `Signature` objects (`hint` + `signature`). In a production setup you would derive these values from a real Stellar keypair using the `@stellar/stellar-sdk`. For this tutorial we represent the keypair as two hex strings to keep the focus on the library's API.

```typescript
// In production: derive hint and signature from a real keypair.
// Hint = last 4 bytes of the public key; signature = Ed25519 signature over the transaction hash.
const myKeypair: Signature = {
  hint: 'a1b2c3d4',       // 4-byte key hint (hex)
  signature: 'deadbeef',  // Ed25519 signature over the transaction hash (hex)
};
```

> **Note:** Never hard-code real private keys or signatures. Use environment variables or a secrets manager in production.

---

## Step 3 — Build a transaction

Construct a `Transaction` that describes what you want to do on-chain. Here we send a payment from one account to another.

```typescript
const tx: Transaction = {
  sourceAccount: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN', // sender's public key
  fee: 100,              // base fee in stroops (1 XLM = 10,000,000 stroops)
  sequenceNumber: '1234567891', // must be sourceAccount's current sequence + 1
  operations: [
    {
      type: 'payment',
      destination: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      asset: 'native',
      amount: '10.0000000', // 10 XLM
    },
  ],
  memo: 'Hello from sharif-soroban-tools',
  signatures: [], // we will attach the signature in the next step
};
```

---

## Step 4 — Sign the transaction

Append your `Signature` to the transaction's `signatures` array. A transaction must have at least one signature before it can be submitted.

```typescript
// Sign by pushing your keypair's Signature onto the signatures array.
tx.signatures.push(myKeypair);
```

If the transaction requires multiple signers (e.g. a multi-sig account), push each additional signature the same way:

```typescript
const cosigner: Signature = {
  hint: 'e5f6a7b8',
  signature: 'cafebabe',
};

tx.signatures.push(cosigner);
```

---

## Step 5 — Wrap in a TransactionEnvelope

The `CoreEngine` expects a `StellarEnvelope`, so wrap your signed transaction before submitting.

```typescript
const envelope: TransactionEnvelope = {
  type: 'transaction',
  tx,
};
```

---

## Step 6 — Submit via CoreEngine

Instantiate `CoreEngine` and call `submitEnvelope`. The engine validates the envelope and returns a result object.

```typescript
const engine = new CoreEngine();
const result = await engine.submitEnvelope(envelope);

if (result.success) {
  console.log('Transaction submitted successfully.');
} else {
  console.error('Submission failed:', result.reason);
}
```

---

## Full example

Putting it all together:

```typescript
import {
  Transaction,
  TransactionEnvelope,
  Signature,
} from './src/core/transaction';
import { CoreEngine } from './src/core/engine';

async function sendPayment() {
  // 1. Represent the signer's keypair as a Signature
  const signer: Signature = {
    hint: 'a1b2c3d4',
    signature: 'deadbeef',
  };

  // 2. Build the transaction
  const tx: Transaction = {
    sourceAccount: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN',
    fee: 100,
    sequenceNumber: '1234567891',
    operations: [
      {
        type: 'payment',
        destination: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
        asset: 'native',
        amount: '10.0000000',
      },
    ],
    memo: 'Hello from sharif-soroban-tools',
    signatures: [],
  };

  // 3. Attach the signature
  tx.signatures.push(signer);

  // 4. Wrap in an envelope
  const envelope: TransactionEnvelope = {
    type: 'transaction',
    tx,
  };

  // 5. Submit
  const engine = new CoreEngine();
  const result = await engine.submitEnvelope(envelope);

  if (result.success) {
    console.log('Transaction submitted successfully.');
  } else {
    console.error('Submission failed:', result.reason);
  }
}

sendPayment();
```

---

## Advanced: Fee bump transactions

A fee bump lets a third-party account (`feeSource`) pay the fee for an inner transaction that has already been signed. This is useful for sponsored transactions or gas-less UX flows.

The inner transaction must be fully built and signed first (Steps 1–5 above), then wrapped inside a `FeeBumpTransactionEnvelope`.

```typescript
import {
  FeeBumpTransactionEnvelope,
  Signature,
  Transaction,
} from './src/core/transaction';
import { CoreEngine } from './src/core/engine';

async function sponsoredPayment() {
  // Inner transaction — signed by the original sender
  const innerTx: Transaction = {
    sourceAccount: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN',
    fee: 100,
    sequenceNumber: '1234567891',
    operations: [
      {
        type: 'payment',
        destination: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
        asset: 'native',
        amount: '5.0000000',
      },
    ],
    signatures: [{ hint: 'a1b2c3d4', signature: 'deadbeef' }],
  };

  // Fee bump envelope — signed by the fee-paying account
  const feeBumpEnvelope: FeeBumpTransactionEnvelope = {
    type: 'feeBump',
    feeBumpTx: {
      feeSource: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5', // sponsor
      fee: 200, // must be >= baseFee * max(operationCount, 1)
      innerTx,
      signatures: [{ hint: 'e5f6a7b8', signature: 'cafebabe' }], // sponsor's signature
    },
  };

  const engine = new CoreEngine();
  const result = await engine.submitEnvelope(feeBumpEnvelope);

  if (result.success) {
    console.log('Fee bump transaction submitted successfully.');
  } else {
    console.error('Submission failed:', result.reason);
  }
}

sponsoredPayment();
```

### Fee validation rules

`validateFeeBumpTransactionEnvelope` enforces these rules automatically when you call `submitEnvelope`:

| Rule | Detail |
|------|--------|
| Minimum fee | `feeBumpTx.fee >= baseFee * max(operationCount, 1)` |
| Fee source signatures | At least one signature on the fee bump itself |
| Inner tx signatures | At least one signature on the inner transaction |
| Inner tx minimum fee | `innerTx.fee >= baseFee * operationCount` |

---

## Common errors

| Error message | Cause | Fix |
|---------------|-------|-----|
| `Fee bump transaction fee X is less than required minimum Y` | `feeBumpTx.fee` is too low | Increase the fee to at least `baseFee * operationCount` |
| `Fee bump transaction requires at least one fee source signature` | Missing signatures on the outer envelope | Push a `Signature` to `feeBumpTx.signatures` |
| `Inner transaction requires at least one signature` | Inner tx has no signatures | Push a `Signature` to `innerTx.signatures` |
| `Inner transaction fee is below the base fee requirement` | `innerTx.fee` is too low | Set `innerTx.fee >= baseFee` |

---

## Next steps

- Explore the [Quickstart guide](./quickstart.md) to deploy a Hello World Soroban contract end-to-end.
- Read `src/core/transaction.ts` for the full type definitions.
- See `tests/core_transaction.test.ts` for more envelope construction examples.
