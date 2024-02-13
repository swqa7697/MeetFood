const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    userName: {
      type: String,
      // unique: true,
    },
    firstName: {
      type: String,
    },
    lastName: {
      type: String,
    },
    profilePhoto: {
      type: String,
    },
    videos: [
      {
        videoPost: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'VideoPost',
        },
      },
    ],
    collections: [
      {
        videoPost: {
          type: String, // need type string to compare with params.videoPostId
          ref: 'VideoPost',
        },
      },
    ],
    likedVideos: [
      {
        videoPost: {
          type: String, // need type string to compare with params.videoPostId
          ref: 'VideoPost',
        },
      },
    ],
  },
  { collection: 'users' },
);

module.exports = mongoose.model('User', userSchema);
