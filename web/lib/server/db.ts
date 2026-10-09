import "server-only"
import oracledb, {
  type Connection,
  type BindParameters,
  type Pool,
} from "oracledb"
import { MongoClient } from "mongodb"
import type { Row } from "@/lib/types"

const state = globalThis as typeof globalThis & {
  smartmoveOracle?: Promise<Pool>
  smartmoveMongo?: Promise<MongoClient>
}
export { oracledb }
export function schema() {
  const value = process.env.ORACLE_SCHEMA || "SMARTMOVE_DATABASE"
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(value))
    throw new Error("Invalid Oracle schema configuration")
  return value
}
export async function connection() {
  const {
    ORACLE_USER: user,
    ORACLE_PASSWORD: password,
    ORACLE_CONNECT_STRING: connectString,
  } = process.env
  if (!user || !password || !connectString)
    throw new Error("Oracle is not configured")
  state.smartmoveOracle ??= oracledb
    .createPool({
      user,
      password,
      connectString,
      poolMin: 0,
      poolMax: 6,
      poolTimeout: 60,
      queueTimeout: 10000,
    })
    .catch((error) => {
      state.smartmoveOracle = undefined
      throw error
    })
  const c = await (await state.smartmoveOracle).getConnection()
  c.callTimeout = 15000
  return c
}
export async function using<T>(
  fn: (c: Connection) => Promise<T>,
  commit = false
) {
  const c = await connection()
  try {
    const result = await fn(c)
    if (commit) await c.commit()
    return result
  } catch (error) {
    await c.rollback()
    throw error
  } finally {
    await c.close()
  }
}
export async function rows<T = Row>(
  c: Connection,
  sql: string,
  binds: BindParameters = {}
): Promise<T[]> {
  const result = await c.execute<Record<string, unknown>>(sql, binds, {
    outFormat: oracledb.OUT_FORMAT_OBJECT,
    maxRows: 1000,
  })
  return (result.rows || []).map(
    (row) =>
      Object.fromEntries(
        Object.entries(row).map(([k, v]) => [
          k.toLowerCase(),
          v instanceof Date ? v.toISOString() : v,
        ])
      ) as T
  )
}
export const iso = (column: string) =>
  `TO_CHAR(${column}, 'YYYY-MM-DD"T"HH24:MI:SS') || '+05:30'`
export async function mongo() {
  if (!process.env.MONGODB_URI) throw new Error("MongoDB is not configured")
  state.smartmoveMongo ??= new MongoClient(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 6000,
  }).connect()
  try {
    return (await state.smartmoveMongo).db(
      process.env.MONGODB_DB || "smartmove"
    )
  } catch (error) {
    state.smartmoveMongo = undefined
    throw error
  }
}
