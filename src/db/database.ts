import { Pool } from "pg";

// Database pool configuration
export const db = new Pool({
  user: "myuser",
  host: "db", // Docker uses 'db' to refer to the database container
  database: "mydatabase",
  password: "mypassword",
  port: 5432,
});

// Function to create tables when the application starts
const createTables = async () => {
  const blockTable = `
    CREATE TABLE IF NOT EXISTS blocks (
      id TEXT PRIMARY KEY,
      height INTEGER NOT NULL UNIQUE
    );
  `;

  const transactionTable = `
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,                              -- Transaction ID
      block_id TEXT REFERENCES blocks(id),              -- Reference to the block it belongs to
      tx_index INTEGER NOT NULL,                        -- Index of the transaction in the block
      address TEXT NOT NULL,                            -- Address involved (sender/receiver)
      value NUMERIC NOT NULL,                           -- Value (positive for output, negative for input)
      input_ref_tx_id TEXT,                             -- Reference to previous transaction (for inputs)
      input_ref_index INTEGER,                          -- Reference to output index in the previous transaction
      UNIQUE (id, block_id, tx_index)                   -- Ensure no duplicate transactions
    );
  `;

  const balanceTable = `
    CREATE TABLE IF NOT EXISTS balances (
      address TEXT PRIMARY KEY,                         -- Address (unique)
      balance NUMERIC DEFAULT 0                         -- Current balance of the address
    );
  `;

  try {
    await db.query(blockTable);
    await db.query(transactionTable);
    await db.query(balanceTable);
    console.log("Tables created successfully");
  } catch (error) {
    console.error("Error creating tables:", error);
  }
};

// Initialize the database and its tables
export const initializeDatabase = async () => {
  try {
    await db.connect(); // Establish the connection to the database
    console.log("Connected to the database");
    await createTables(); // Create the tables
  } catch (error) {
    console.error("Error connecting to the database:", error);
  }
};
