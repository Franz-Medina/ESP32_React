const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "mypassword",
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5431),
  database: process.env.DB_NAME || "authdb",
});

module.exports = pool;