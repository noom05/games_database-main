import { createPool } from "mysql2/promise";

export const conn = createPool({
  connectionLimit: 10,
  host: "202.28.34.210",
  user: "66011212136",
  password: "66011212136",
  database: "db66011212136",
  port: 3309
});
