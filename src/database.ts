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
      id TEXT PRIMARY KEY,
      block_id TEXT REFERENCES blocks(id),
      UNIQUE (id, block_id) -- Ensure no duplicate transactions in a block
    );
  `;

  const outputTable = `
    CREATE TABLE IF NOT EXISTS outputs (
      id SERIAL PRIMARY KEY,
      tx_id TEXT REFERENCES transactions(id),
      index INTEGER NOT NULL,
      address TEXT NOT NULL,
      value NUMERIC NOT NULL,
      UNIQUE (tx_id, index) -- Ensure each output in a transaction is unique
    );
  `;

  const balanceTable = `
    CREATE TABLE IF NOT EXISTS balances (
      address TEXT PRIMARY KEY,
      balance NUMERIC DEFAULT 0
    );
  `;

  try {
    await db.query(blockTable);
    await db.query(transactionTable);
    await db.query(outputTable);
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
