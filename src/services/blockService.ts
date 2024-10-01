import type { Block, Transaction, Input } from '../models/blockModel';
import * as db from '../db/queries';
import crypto from "crypto";


class BlockService {
  // Main function to process a block
  async processBlock(block: Block): Promise<void> {
    // Validate block height
    await this.validateBlockHeight(block.height);
    
    // Validate transaction sums
    await this.validateTransactionSums(block.transactions);
    
    // Validate block ID (hash)
    await this.validateBlockId(block);

     // Insert the block
     await db.insertBlock(block.id, block.height);
     
    // Update balances and insert transactions
    await this.updateBalancesAndInsertTransactions(block);

   
  }

  // Validate the block height
  private async validateBlockHeight(height: number): Promise<void> {
    const currentHeight = await db.getBlockHeight();
    if (height !== currentHeight + 1) {
      throw new Error(`Invalid block height. Expected ${currentHeight + 1}, but got ${height}`);
    }
  }

  // Validate that input values match output values for all transactions
  private async validateTransactionSums(transactions: Transaction[]): Promise<void> {
    for (const transaction of transactions) {
      // If the transaction has no inputs, it's a coinbase transaction and we skip validation.
      if (transaction.inputs.length === 0) {
        continue; // Skip input-output sum validation for coinbase transactions
      }
  
      // Otherwise, we validate input/output sum equality
      const inputSum = await this.getTransactionInputSum(transaction.inputs);
      const outputSum = transaction.outputs.reduce((sum, output) => sum + output.value, 0);
  
      if (inputSum !== outputSum) {
        throw new Error(`Invalid transaction sum. Input sum: ${inputSum}, Output sum: ${outputSum}`);
      }
    }
  }
  

  // Validate the block ID based on a hash of its data
  private async validateBlockId(block: Block): Promise<void> {


    const transactionIds = block.transactions.map((tx) => tx.id).join("");
    const hash = crypto
      .createHash("sha256")
      .update(`${block.height}${transactionIds}`)
      .digest("hex");

    // const calculatedId = calculateBlockId(block);
    // if (calculatedId !== block.id) return "Invalid block ID";

    // const combinedData = block.height + block.transactions.map(tx => tx.id).join('');
    // const hash = sha256(combinedData).toString('hex');
    if (hash !== block.id) {
      throw new Error(`Invalid block ID. Expected hash: ${hash}, but got ${block.id}`);
    }
  }

  // Update balances for inputs/outputs and insert transactions
  private async updateBalancesAndInsertTransactions(block: Block): Promise<void> {
    for (const transaction of block.transactions) {
      // Insert coinbase transactions (no inputs)
      if (transaction.inputs.length === 0) {
        // Handle coinbase transaction: Only insert outputs and update balances
        for (let i = 0; i < transaction.outputs.length; i++) {
          const output = transaction.outputs[i];
          await db.insertTransaction(transaction.id, block.id, i, output.address, output.value,null,null);  // Insert coinbase transaction output
          await db.updateBalance(output.address, output.value);  // Add the value to the recipient's balance
        }
        continue; // Skip input processing for coinbase transactions
      }
  
      // Process regular transactions with inputs and outputs
      for (const input of transaction.inputs) {
        const value = await db.getInputValue(input.txId, input.index);  // Get value of previous transaction's output
        const address = await db.getAddressFromInput(input.txId, input.index);  // Get the input address
        await db.insertTransaction(transaction.id, block.id, input.index, address, -value, input.txId, input.index);  // Insert input as negative value
        await db.updateBalance(address, -value);  // Deduct the value from the address
      }
  
      // Insert outputs (positive values)
      for (let i = 0; i < transaction.outputs.length; i++) {
        const output = transaction.outputs[i];
        await db.insertTransaction(transaction.id, block.id, i, output.address, output.value,null,null);  // Insert output as positive value
        await db.updateBalance(output.address, output.value);  // Add the value to the address
      }
    }
  }
  
  
  // Calculate the sum of all inputs in a transaction
  private async getTransactionInputSum(inputs: Input[]): Promise<number> {
    let sum = 0;
    for (const input of inputs) {
      const inputValue = await db.getInputValue(input.txId, input.index);
      sum += Math.abs(inputValue);  // Use absolute value for validation
    }
    return sum;
  }
  
}

export default new BlockService();
