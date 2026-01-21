'use strict';
const jwt = require("jsonwebtoken");
const config = require("config")
module.exports = class jwtService {
    constructor() { }

    createJwtToken(user) {
        return jwt.sign({ user }, process.env.SECRET, {
            algorithm: config.get("jwt.algorithm"),
            // expiresIn: config.get("jwt.expiresIn"),
            issuer: config.get("jwt.issuer"),
            audience: config.get("jwt.audience")
        });
    }
};
