const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const constants = require('../util/constants');

const videoPostSchema = new mongoose.Schema(
  {
    postTitle: {
      type: String,
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    videoUrl: {
      type: String,
      required: true,
    },
    coverImageUrl: {
      type: String,
    },
    restaurantName: {
      type: String,
    },
    restaurantAddress: {
      street: {
        type: String,
        // required: true,
      },
      city: {
        type: String,
        // required: true,
      },
      state: {
        type: String,
        uppercase: true,
        // required: true,
        enum: constants.statesArray,
      },
      zipcode: {
        type: Number,
        // required: true,
      },
    },
    orderedVia: {
      type: String,
    },
    postTime: {
      type: Date,
      required: true,
    },
    countComment: {
      type: Number,
      default: 0,
    },
    countLike: {
      type: Number,
      default: 0,
    },
    countCollections: {
      type: Number,
      default: 0,
    },
    likes: [
      {
        userSub: {
          type: String,
        },
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
      },
    ],
    comments: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        text: {
          type: String,
          required: true,
        },
        name: {
          type: String,
        },
        avatar: {
          type: String,
        },
        date: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { collection: 'videoposts' },
);

videoPostSchema.plugin(mongoosePaginate);
module.exports = mongoose.model('VideoPost', videoPostSchema);
