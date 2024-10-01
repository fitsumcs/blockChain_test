import { db } from "./database";

// Get the current maximum block height
export async function getBlockHeight(): Promise<number> {
  const result = await db.query('SELECT COALESCE(MAX(height), 0) AS height FROM blocks');
  return result.rows[0].height;
}

// Insert a new block into the blocks table
export async function insertBlock(blockId: string, height: number): Promise<void> {
  await db.query(
    'INSERT INTO blocks (id, height) VALUES ($1, $2)',
    [blockId, height]
  );
}

// Insert a new transaction into the transactions table
export async function insertTransaction(txId: string, blockId: string, txIndex: number, address: string, value: number, inputTxId: string | null, inputIndex: number | null): Promise<void> {
    await db.query(
      `
      INSERT INTO transactions (id, block_id, tx_index, address, value, input_ref_tx_id, input_ref_index)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO NOTHING;
      `,
      [txId, blockId, txIndex, address, value, inputTxId, inputIndex]
    );
  }
  

// Fetch the value of an input transaction (input value from previous transaction output)
export async function getInputValue(txId: string, index: number): Promise<number> {
    const result = await db.query(
      'SELECT value FROM transactions WHERE id = $1 AND tx_index = $2',
      [txId, index]
    );
  
    // If no result is found, return 0, otherwise return the value as a number
    if (result.rows.length === 0) {
      throw new Error(`Input not found: Transaction ID ${txId}, Index ${index}`);
    }
  
    return Number(result.rows[0].value);
  }
  
  

// Fetch the address from a previous transaction input
export async function getAddressFromInput(txId: string, index: number): Promise<string> {
  const result = await db.query(
    'SELECT address FROM transactions WHERE id = $1 AND tx_index = $2',
    [txId, index]
  );
  return result.rows[0]?.address || '';
}

// Get balance for an address
export async function getBalance(address: string): Promise<number> {
  const result = await db.query('SELECT balance FROM balances WHERE address = $1', [address]);
  return result.rows[0]?.balance || 0;
}

// Update balance for an address
export async function updateBalance(address: string, amount: number): Promise<void> {
  await db.query(
    `
    INSERT INTO balances (address, balance)
    VALUES ($1, $2)
    ON CONFLICT (address)
    DO UPDATE SET balance = balances.balance + EXCLUDED.balance
    `,
    [address, amount]
  );
}
