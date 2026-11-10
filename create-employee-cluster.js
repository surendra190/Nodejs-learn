require("dotenv").config();
const { Pool } = require("pg");

// Connect using PostgreSQL admin credentials
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB__USER,
  password: process.env.DB_PASSWORD,
});

async function createEmployeeClusterTable() {
  try {
    console.log("Connecting to PostgreSQL...");

    // 1. Create employee_cluster table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.employees_cluster (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        department VARCHAR(100),
        salary NUMERIC(10,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("Employee cluster table created successfully.");

    // 2. Grant INSERT and SELECT permissions
    await pool.query(`
      GRANT INSERT, SELECT
      ON TABLE public.employees_cluster
      TO raguser;
    `);

    console.log("INSERT and SELECT permissions granted.");

    // 3. Grant sequence permissions for auto-increment ID
    await pool.query(`
      GRANT USAGE, SELECT
      ON SEQUENCE public.employees_cluster_id_seq
      TO raguser;
    `);

    console.log("Sequence permissions granted.");

    // 4. Verify permissions
    const result = await pool.query(`
      SELECT
        has_table_privilege(
          'raguser',
          'public.employees_cluster',
          'INSERT'
        ) AS can_insert,
        has_table_privilege(
          'raguser',
          'public.employees_cluster',
          'SELECT'
        ) AS can_select;
    `);

    console.log("Permission verification:", result.rows[0]);
  } catch (error) {
    console.error("Table creation failed:", error);
  } finally {
    await pool.end();
  }
}

createEmployeeClusterTable();
