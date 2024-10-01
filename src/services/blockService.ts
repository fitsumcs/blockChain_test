import crypto from "crypto";
import type { Block, Input, Transaction } from "../models/blockModel";
import { db } from "../database";
import type { PoolClient } from "pg";

// Get balance for a specific address
export async function getBalanceForAddress(address: string): Promise<number> {
  const result = await db.query(
    "SELECT balance FROM balances WHERE address = $1",
    [address]
  );

  if (result.rows.length === 0) {
    throw new Error("Address not found");
  }

  return parseFloat(result.rows[0].balance);
}

// Update balance for a specific address
export async function updateBalance(address: string, value: number) {
  await db.query(
    "INSERT INTO balances (address, balance) VALUES ($1, $2) ON CONFLICT (address) DO UPDATE SET balance = balances.balance + $2",
    [address, value]
  );
}

// Validate the block and its transactions
// export async function validateBlock(block: Block) {
//   console.log("reach here validateBlock start");

//   const currentHeight = await getCurrentHeight();

//   console.log("reach here currentHeight start");

//   // Validate block height
//   if (block.height !== currentHeight + 1) {
//     throw new Error("Invalid block height");
//   }

//   // Validate inputs = outputs for each transaction
//   for (const tx of block.transactions) {
//     const totalInput = await Promise.all(
//       tx.inputs.map(async (input) => {
//         const result = await db.query(
//           "SELECT value FROM transactions WHERE id = $1 AND output_index = $2",
//           [input.txId, input.index]
//         );
//         console.log("reach here totalInput start", totalInput);

//         return result.rows.length > 0 ? parseFloat(result.rows[0].value) : 0; // Get the value of the input
//       })
//     );

//     console.log("reach here loop  end");

//     const totalOutput = tx.outputs.reduce(
//       (sum, output) => sum + output.value,
//       0
//     );

//     console.log("reach here totalOutput  end");

//     // Check if inputs equal outputs
//     if (totalInput.reduce((sum, val) => sum + val, 0) !== totalOutput) {
//       throw new Error("Inputs do not equal outputs");
//     }
//   }

//   // Validate block ID
//   const blockId = crypto
//     .createHash("sha256")
//     .update(block.height + block.transactions.map((tx) => tx.id).join(""))
//     .digest("hex");

//   if (block.id !== blockId) {
//     throw new Error("Invalid block ID");
//   }

//   console.log("reach here validation");
// }

// Add block and its transactions to the database
export async function addBlock(block: Block) {
  console.log("reach here add start");

  await db.query("INSERT INTO blocks (id, height) VALUES ($1, $2)", [
    block.id,
    block.height,
  ]);

  await Promise.all(
    block.transactions.map(async (tx) => {
      await db.query(
        "INSERT INTO transactions (id, block_id) VALUES ($1, $2)",
        [tx.id, block.id]
      );
      await Promise.all(
        tx.outputs.map(async (output, index) => {
          await db.query(
            "INSERT INTO outputs (tx_id, index, address, value) VALUES ($1, $2, $3, $4)",
            [tx.id, index, output.address, output.value]
          );
        })
      );
    })
  );

  console.log("reach here");
}

// Update balances based on transactions in the block
export async function updateBalances(block: Block) {
  console.log("reach here update start");
  await Promise.all(
    block.transactions.map(async (tx) => {
      // Spend inputs
      await Promise.all(
        tx.inputs.map(async (input) => {
          const result = await db.query(
            "SELECT output_address, value FROM outputs WHERE tx_id = $1 AND index = $2",
            [input.txId, input.index]
          );
          if (result.rows.length > 0) {
            const { output_address, value } = result.rows[0];
            await updateBalance(output_address, -value);
          }
        })
      );

      // Add outputs
      await Promise.all(
        tx.outputs.map(async (output) => {
          await updateBalance(output.address, output.value);
        })
      );
    })
  );

  console.log("reach here update");
}

// Get the current maximum block height
// async function getCurrentHeight(): Promise<number> {
//   const result = await db.query("SELECT MAX(height) AS height FROM blocks");
//   return result.rows[0].height || 0;
// }

// Rollback the state of the indexer to the given height
export async function rollbackToHeightInDb(targetHeight: number) {
  try {
    // Get all transaction IDs with height greater than targetHeight
    const transactionsResult = await db.query(
      `
      SELECT id FROM transactions
      WHERE block_id IN (
        SELECT id FROM blocks WHERE height > $1
      )
    `,
      [targetHeight]
    );

    const transactionIds = transactionsResult.rows.map((row) => row.id);

    // Delete transactions and outputs above the target height
    await db.query(
      `
      DELETE FROM outputs WHERE tx_id IN (
        SELECT id FROM transactions WHERE block_id IN (
          SELECT id FROM blocks WHERE height > $1
        )
      )
    `,
      [targetHeight]
    );

    await db.query(
      `
      DELETE FROM transactions
      WHERE block_id IN (
        SELECT id FROM blocks WHERE height > $1
      )
    `,
      [targetHeight]
    );

    // Recalculate balances
    const balancesResult = await db.query(
      "SELECT address, SUM(value) AS balance FROM outputs WHERE tx_id IN (SELECT id FROM transactions WHERE block_id IN (SELECT id FROM blocks WHERE height <= $1)) GROUP BY address",
      [targetHeight]
    );

    // Update balances in the balances table
    await Promise.all(
      balancesResult.rows.map(async ({ address, balance }) => {
        await updateBalance(address, balance);
      })
    );

    console.log("Rollback to height", targetHeight, "successful");
  } catch (error) {
    console.error("Error during rollback:", error);
    throw new Error("Rollback failed");
  }
}

export const validateBlock = async (block: Block) => {
  const currentHeight = getCurrentHeight(); // implement this function based on your logic
  if (block.height !== (await currentHeight) + 1) return "Invalid block height";

  for (const transaction of block.transactions) {
    const inputsSum = transaction.inputs.reduce((sum, input) => sum + 0, 0);
    const outputsSum = transaction.outputs.reduce(
      (sum, output) => sum + output.value,
      0
    );

    // if (inputsSum !== outputsSum) return "Input and output values do not match";
  }

  const calculatedId = calculateBlockId(block);
  if (calculatedId !== block.id) return "Invalid block ID";

  return null; // No errors
};

export const createBlock = async (block: Block) => {
  // Validate the block
  const validationError = await validateBlock(block);

  if (validationError) throw new Error(validationError);

  const client = await db.connect();
  try {
    await client.query("BEGIN"); // Start transaction

    // Process transactions and update balances
    for (const transaction of block.transactions) {
      await processTransaction(transaction, client);
    }

    const blockId = await getBlockId(block);
    await client.query("INSERT INTO blocks (id, height) VALUES ($1, $2)", [
      blockId,
      block.height,
    ]);

    await client.query("COMMIT"); // Commit transaction
    return "Block added successfully";
  } catch (error) {
    await client.query("ROLLBACK"); // Rollback transaction in case of error
    throw new Error("Internal Server Error");
  } finally {
    client.release(); // Release the client back to the pool
  }
};

const processTransaction = async (
  transaction: Transaction,
  client: PoolClient
) => {
  // Process each transaction
  for (const output of transaction.outputs) {
    await client.query(
      `INSERT INTO balances (address, balance)
             VALUES ($1, $2)
             ON CONFLICT (address) DO UPDATE SET balance = balance + $2`,
      [output.address, output.value]
    );
  }

  for (const input of transaction.inputs) {
    const previousTransaction = await client.query(
      `SELECT outputs FROM transactions WHERE id = $1`,
      [input.txId]
    );

    const output = previousTransaction.rows[0].outputs[input.index];
    await client.query(
      `UPDATE balances SET balance = balance - $1 WHERE address = $2`,
      [output.value, output.address]
    );
  }
};

const getBlockId = async (block: Block) => {
  const transactionIds = block.transactions.map((tx) => tx.id).join("");
  const blockId = require("crypto")
    .createHash("sha256")
    .update(`${block.height}${transactionIds}`)
    .digest("hex");
  return blockId;
};

const calculateBlockId = (block: Block) => {
  const transactionIds = block.transactions.map((tx) => tx.id).join("");
  return crypto
    .createHash("sha256")
    .update(`${block.height}${transactionIds}`)
    .digest("hex");
};

const getInputValue = async (input: Input) => {
  const client = await db.connect();
  try {
    const result = await client.query(
      "SELECT outputs FROM transactions WHERE id = $1",
      [input.txId]
    );

    if (result.rows.length === 0) return 0; // Transaction not found

    // Assuming outputs are stored as an array of JSON objects
    const outputs = result.rows[0].outputs;
    const output = outputs[input.index];

    return output ? output.value : 0; // Return the value if found, else 0
  } catch (error) {
    console.error("Error fetching input value:", error);
    return 0; // Return 0 in case of an error
  } finally {
    client.release(); // Ensure client is released
  }
};

const getCurrentHeight = async () => {
  const client = await db.connect();
  try {
    const result = await client.query(
      "SELECT height FROM blocks ORDER BY height DESC LIMIT 1"
    );

    if (result.rows.length === 0) return 0; // No blocks in the database

    return result.rows[0].height; // Return the highest height found
  } catch (error) {
    console.error("Error fetching current height:", error);
    return 0; // Return 0 in case of an error
  } finally {
    client.release(); // Ensure client is released
  }
};
