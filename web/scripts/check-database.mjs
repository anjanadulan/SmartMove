// Read-only readiness check: no DDL, inserts, updates, commits, or sample resets.
import oracledb from "oracledb";
import { MongoClient } from "mongodb";
import { existsSync } from "node:fs";
if(existsSync(".env.local"))process.loadEnvFile(".env.local");
const owner=process.env.ORACLE_SCHEMA || "SMARTMOVE_DATABASE";
if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(owner))throw new Error("Invalid schema name");
let connection,client;
try {
  connection=await oracledb.getConnection({user:process.env.ORACLE_USER,password:process.env.ORACLE_PASSWORD,connectString:process.env.ORACLE_CONNECT_STRING});
  connection.callTimeout=15000;
  for(const table of ["app_users","passengers","drivers","vehicles","routes","trips","bookings","tickets","payments","refunds","maintenance_records","feedback_records","booking_status_history","web_sessions","web_admin_sessions"]) {
    const result=await connection.execute(`SELECT COUNT(*) FROM ${owner}.${table}`);
    console.log(`${table}: ${result.rows[0][0]} records`);
  }
  const future=await connection.execute(`SELECT COUNT(*) FROM ${owner}.trips WHERE status='SCHEDULED' AND departure_at>SYSDATE`);
  console.log(`Future scheduled trips: ${future.rows[0][0]}`);
  const auth=await connection.execute(`SELECT role,COUNT(*),SUM(CASE WHEN password_hash LIKE 'scrypt:%' THEN 1 ELSE 0 END) FROM ${owner}.app_users GROUP BY role`);
  for(const [role,count,enabled] of auth.rows)console.log(`${role}: ${count} accounts, ${enabled} compatible password hashes`);
  const required=["CREATE_BOOKING","RESERVE_SEAT","AVAILABLE_SEATS","RECORD_PAYMENT","WEB_REGISTER_PASSENGER","WEB_CANCEL_BOOKING","WEB_UPDATE_PROFILE","WEB_SUBMIT_FEEDBACK","POPULAR_ROUTES","PASSENGER_HISTORY","MAINTENANCE_DUE","TRIP_OCCUPANCY","WEB_REVENUE_PERIOD"];
  const installed=await connection.execute("SELECT object_name,status FROM all_objects WHERE owner=:owner AND object_type IN ('PROCEDURE','FUNCTION')",{owner:owner.toUpperCase()});
  for(const name of required) {const found=installed.rows.find(r=>r[0]===name);console.log(`${name}: ${found?.[1] || 'not accessible / not installed'}`);}
  client=await new MongoClient(process.env.MONGODB_URI || "mongodb://localhost:27017",{serverSelectionTimeoutMS:6000}).connect();
  const db=client.db(process.env.MONGODB_DB || "smartmove");
  await db.command({ping:1});
  for(const collection of ["feedback_content","vehicle_assets","announcements","notifications","trip_media"])console.log(`MongoDB ${collection}: ${await db.collection(collection).countDocuments()} documents`);
  console.log("Read-only database readiness check completed.");
} catch(error) {console.error("Readiness check failed:",error.code || error.name);process.exitCode=1;}
finally {await connection?.close();await client?.close();}
