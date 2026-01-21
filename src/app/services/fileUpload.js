const multer = require("multer"),
  multerS3 = require("multer-s3");
const { S3Client, HeadObjectCommand } = require("@aws-sdk/client-s3");
const { CopyObjectCommand } = require("@aws-sdk/client-s3");

s3 = new S3Client({
  credentials: {
    secretAccessKey: process.env.AWS_SECRET_KEY,
    accessKeyId: process.env.AWS_ACCESS_KEY,
  },
  region: process.env.BUCKET_REGION,
});

module.exports = {
  upload: multer({
    storage: multerS3({
      s3: s3,
      acl: "public-read",
      bucket: process.env.BUCKET_NAME,
      key: function (req, file, cb) {
        // console.log("came in upload", file);
        let filename = file.originalname.replaceAll(" ", "");
        if (file.originalname === "blob") {
          const type = file.mimetype.split("/")[1];
          filename = `${file.originalname}.${type}`;
          // console.log("came in upload", filename);
        }
        cb(null, `${new Date().getTime()}-${filename}`);
      },
    }),
  }),

  updateImageExtension: async (oldKey, newExtension) => {
    try {
      // // Derive new file name by replacing extension
      // const newKey = oldKey.replace(/\.[^/.]+$/, `.${newExtension}`);
      const command = new HeadObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: oldKey
      });
      // const command = new CopyObjectCommand({
      //   Bucket: process.env.BUCKET_NAME,
      //   CopySource: `${process.env.BUCKET_NAME}/${oldKey}`, // source path
      //   Key: oldKey,
      //   ContentType: 'image/png',
      //   MetadataDirective: "REPLACE" // tells S3 to replace metadata
      // });
      const response = await s3.send(command);
      // // Step 1: Copy object with new extension
      // await s3.copyObject({
      //   Bucket: bucketName,
      //   CopySource: `${bucketName}/${oldKey}`,
      //   Key: newKey
      // }).promise();

      // // Step 2: Delete old object
      // await s3.deleteObject({
      //   Bucket: bucketName,
      //   Key: oldKey
      // }).promise();
      // console.log(response)
      // console.log(`Image extension updated: ${oldKey}}`);
    } catch (err) {
      // console.error("Error updating image extension:", err);
    }
  }
};
