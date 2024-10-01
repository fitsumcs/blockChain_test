import type { Request, Response } from "express";

import { getBalanceForAddress } from "../services/blockService";

export async function getBalance(req: Request, res: Response) {
  const { address } = req.params;

  try {
    const balance = await getBalanceForAddress(address);
    res.status(200).json({ address, balance });
  } catch (error) {
    res.status(400).json({ error: "Address not found" });
  }
}
