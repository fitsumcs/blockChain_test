import type { Request, Response } from "express";

import { rollbackToHeightInDb } from "../services/blockService";

export async function rollbackToHeight(req: Request, res: Response) {
  const { height } = req.query;

  try {
    await rollbackToHeightInDb(parseInt(height as string, 10));
    res.status(200).send({ message: "Rollback successful" });
  } catch (error) {
    res.status(400).send({ error: error });
  }
}
