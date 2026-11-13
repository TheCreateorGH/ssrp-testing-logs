"use strict";

const PORT = process.env.PORT || 28519; // 28. May 2019 is SSRP Creation date
const IP = process.env.IP || process.env.HOST || "0.0.0.0";

module.exports = { IP, PORT };
