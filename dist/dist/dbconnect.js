"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.conn = void 0;
const promise_1 = require("mysql2/promise");
exports.conn = (0, promise_1.createPool)({
    connectionLimit: 10,
    host: "202.28.34.210",
    user: "66011212136",
    password: "66011212136",
    database: "db66011212136",
    port: 3309
});
