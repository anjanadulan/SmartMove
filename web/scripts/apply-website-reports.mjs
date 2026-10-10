// Applies only the additive 13_website_reports.sql, never the base/sample scripts.
import { readFileSync } from "node:fs";
import oracledb from "oracledb";
process.loadEnvFile(".env.local");
const local = Object.fromEntries(readFileSync("../.env.smartmove.local","utf8").split(/\r?\n/).filter(line=>/^[A-Z_]+=/.test(line)).map(line=>{const i=line.indexOf("=");return [line.slice(0,i),line.slice(i+1)];}));
const owner=process.env.ORACLE_SCHEMA || "SMARTMOVE_DATABASE";
if(local.ORACLE_OWNER_USER?.toUpperCase()!==owner.toUpperCase())throw new Error("Owner account does not match the selected schema");
const c=await oracledb.getConnection({user:local.ORACLE_OWNER_USER,password:local.ORACLE_OWNER_PASSWORD,connectString:process.env.ORACLE_CONNECT_STRING});
try {
  const source=readFileSync("../database/oracle/13_website_reports.sql","utf8");
  const procedure=source.match(/CREATE OR REPLACE PROCEDURE[\s\S]*?\n\/\s*\n/)?.[0].replace(/\n\/\s*\n$/," ");
  if(!procedure)throw new Error("Reporting procedure source is missing");
  await c.execute(procedure);
  const errors=await c.execute("SELECT COUNT(*) FROM user_errors WHERE name='WEB_REVENUE_PERIOD'");
  if(errors.rows[0][0])throw new Error("Reporting procedure has compilation errors");
  for(const grant of source.match(/GRANT EXECUTE[^;]+/g) || [])await c.execute(grant);
  console.log("WEB_REVENUE_PERIOD compiled successfully; five reporting grants applied.");
} finally {await c.close();}
