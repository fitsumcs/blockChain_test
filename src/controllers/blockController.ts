import type { Request, Response } from "express";

// import {
//   addBlock,
//   validateBlock,
//   updateBalances,
//   createBlock,
// } from "../services/blockService";
import blockService from '../services/blockService';

import type { Block } from "../models/blockModel";

export async function processBlock(req: Request, res: Response) {
  const block: Block = req.body;
  try {
    await blockService.processBlock(block);
    res.status(200).send({ message: 'Block processed successfully' });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
}
