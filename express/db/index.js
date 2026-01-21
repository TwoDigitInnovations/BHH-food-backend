'use strict';
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
const config = require("config");

const options = {
    keepAlive: 1000,
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true,
  };
  
mongoose.connect(process.env.DATABASE_URL)

mongoose.connection.on('connected', function () {
    console.log('Mongoose connected');
});
mongoose.connection.on('disconnected', function () {
    console.log('Mongoose default connection disconnected');
});
mongoose.connection.on('error', console.error.bind(console, 'MongoDb connection error'));

process.on('SIGINT', function () {
    mongoose.connection.close(function () {
        console.log('Mongoose default connection disconnected through app termination');
        process.exit(0);
    });
});


// async function dropCollection(collectionName) {
//   try {
//     const collections = await mongoose.connection.db
//       .listCollections({ name: collectionName })
//       .toArray();

//     if (collections.length === 0) {
//       console.log(`Collection ${collectionName} does not exist`);
//       return;
//     }

//     await mongoose.connection.dropCollection(collectionName);
//     console.log(`Collection ${collectionName} dropped successfully`);

//     const collectionsAfterDrop = await mongoose.connection.db
//       .listCollections({ name: collectionName })
//       .toArray();

//     if (collectionsAfterDrop.length === 0) {
//       console.log("Verified: Collection no longer exists");
//     } else {
//       console.log("Warning: Collection still exists after drop attempt");
//     }
//   } catch (err) {
//     console.error("Detailed error:", err);
//   }
// }

// async function listAllCollections() {
//   try {
//     const collections = await mongoose.connection.db.listCollections().toArray();
//     console.log("Collections in the database:");
//     collections.forEach((collection) => {
//       console.log(`- ${collection.name}`);
//     });
//   } catch (err) {
//     console.error("Error listing collections:", err);
//   }
// }

// mongoose.connect(process.env.DATABASE_URL, options).then(async () => {
//   try {
//     await listAllCollections(); // List all collections
//     await dropCollection("users"); // Drop a specific collection
//   } catch (err) {
//     console.error("Error:", err);
//   }
// });