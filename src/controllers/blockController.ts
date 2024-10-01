import type { Request, Response } from "express";

import {
  addBlock,
  validateBlock,
  updateBalances,
  createBlock,
} from "../services/blockService";
import type { Block } from "../models/blockModel";

export async function processBlock(req: Request, res: Response) {
  const block: Block = req.body;

  try {
    await createBlock(block); // Check height, inputs vs outputs, block hash
    //await addBlock(block); // Add block to database
    //await updateBalances(block); // Update balances from transactions

    res.status(200).send({ message: "Block processed successfully" });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
}
