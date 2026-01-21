const app = require('express')();
require("dotenv").config();
const passport = require('passport');
const bodyParser = require('body-parser');
const noc = require('no-console');
const cors = require('cors');

// Bootstrap schemas, models
require("./bootstrap");

// App configuration
noc(app);
app.set('trust proxy', true);
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));
app.use(passport.initialize());
app.use(cors());

//Database connection
require('./db');
//Passport configuration
require('./passport')(passport);
//Routes configuration
require("./../src/routes")(app);


module.exports = app;