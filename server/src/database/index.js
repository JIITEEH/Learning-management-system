// The MySQL connection pool, shared by the whole server. Every query in database-queries/ goes
// through the three helpers below, so connection settings live in one place.
import mysql from 'mysql2/promise';
import config from '../config/index.js';

// A pool keeps up to 10 connections open and hands one to each query, instead of opening a new
// connection (slow) for every request.
export const pool = mysql.createPool({
  ...config.db,
  connectionLimit: 10,
  // Lets queries use :name placeholders instead of ?, so a long statement reads clearly
  namedPlaceholders: true,
  // Dates come back as 'YYYY-MM-DD HH:MM:SS' strings, exactly as stored, not as JS Date objects
  dateStrings: true,
});

// Runs one statement and returns its rows (or, for INSERT/UPDATE/DELETE, the result object with
// insertId and affectedRows). Values always go through placeholders, never into the SQL text.
export async function query(sql, params = {}) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

// For a statement that matches at most one row. Returns the row, or null.
export async function queryOne(sql, params = {}) {
  const rows = await query(sql, params);
  return rows[0] ?? null;
}

// Runs `work` inside a transaction: either every statement in it takes effect, or none does.
// `work` receives the connection and must use connection.execute for its statements.
export async function transaction(work) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
