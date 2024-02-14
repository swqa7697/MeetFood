const aws = require('aws-sdk');
const fs = require('fs');
const config = require('../config/production.json');
const { getFileBaseName, addTimeStampToName } = require('./path');

const setS3Credentials = new aws.S3({
  accessKeyId: config.S3AccessKeyID,
  secretAccessKey: config.S3SecretAccessKey,
});

const s3ProfilePhotoParams = (req) => {
  return {
    ACL: 'public-read',
    Bucket: config.S3ProfilePhotoBucketName,
    Body: fs.createReadStream(req.file.path),
    Key: addTimeStampToName(req.file.originalname),
  };
};

const s3CoverImageParams = (req) => {
  return {
    ACL: 'public-read',
    Bucket: config.S3CoverImageBucketName,
    Body: fs.createReadStream(req.file.path),
    Key: addTimeStampToName(req.file.originalname),
  };
};

const s3VideoParams = (req) => {
  return {
    ACL: 'public-read',
    Bucket: config.S3VideoBucketName,
    Body: fs.createReadStream(req.file.path),
    Key: addTimeStampToName(req.file.originalname),
  };
};

const profilePhotoUrlGenerator = (fileName) => {
  return `${config.S3ProfilePhotoUrlPrefix}/${fileName}`;
};

const coverImageUrlGenerator = (fileName) => {
  return `${config.S3CoverImageUrlPrefix}/${fileName}`;
};

const videoUrlGenerator = (fileName) => {
  return `${config.S3VideoUrlPrefix}/${fileName}`;
};

const deleteCoverImageInS3 = (imageUrl) => {
  const s3 = setS3Credentials;

  if (imageUrl) {
    const delParams = {
      Bucket: config.S3CoverImageBucketName,
      Key: getFileBaseName(imageUrl),
    };

    s3.deleteObject(delParams, (err) => {
      if (err) {
        return err;
      }
    });
  }
};

const deleteVideoInS3 = (videoUrl) => {
  const s3 = setS3Credentials;

  if (videoUrl) {
    const delParams = {
      Bucket: config.S3VideoBucketName,
      Key: getFileBaseName(videoUrl),
    };

    s3.deleteObject(delParams, (err) => {
      if (err) {
        return err;
      }
    });
  }
};

module.exports = {
  setS3Credentials,
  s3ProfilePhotoParams,
  s3CoverImageParams,
  s3VideoParams,
  profilePhotoUrlGenerator,
  coverImageUrlGenerator,
  videoUrlGenerator,
  deleteCoverImageInS3,
  deleteVideoInS3,
};
