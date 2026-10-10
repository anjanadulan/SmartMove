import oracledb from "oracledb";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${key.toString("hex")}`;
}

async function main() {
  process.loadEnvFile(".env.local");
  const c = await oracledb.getConnection({
    user: "SMARTMOVE_DATABASE",
    password: "Owner123pw",
    connectString: process.env.ORACLE_CONNECT_STRING
  });

  try {
    const adminHash = await hashPassword("Admin1234#");
    const passHash = await hashPassword("Pass1234#");

    await c.execute(
      `UPDATE ${process.env.ORACLE_SCHEMA}.app_users 
       SET password_hash = :hash 
       WHERE email = 'admin@smartmove.lk'`,
      { hash: adminHash }
    );

    await c.execute(
      `UPDATE ${process.env.ORACLE_SCHEMA}.app_users 
       SET password_hash = :hash 
       WHERE email = 'kasun@gmail.com'`,
      { hash: passHash }
    );

    await c.execute(
      `UPDATE ${process.env.ORACLE_SCHEMA}.app_users 
       SET password_hash = :hash 
       WHERE email = 'nadeesha@gmail.com'`,
      { hash: passHash }
    );

    await c.commit();
    console.log("Successfully updated password hashes for admin@smartmove.lk, kasun@gmail.com, and nadeesha@gmail.com.");
  } finally {
    await c.close();
  }
}

main().catch(console.error);
