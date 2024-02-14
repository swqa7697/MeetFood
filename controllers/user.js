const User = require('../models/user');
const VideoPost = require('../models/videopost');
const config = require('../config/production.json');
const AWS_S3 = require('../util/aws-s3');
const { adminDeleteUser } = require('../util/aws-cognito');
const { getFileBaseName } = require('../util/path');

const s3 = AWS_S3.setS3Credentials;

/**
 * @api {post} /api/v1/user/create UserCreate
 * @apiName UserCreate
 * @apiGroup User
 * @apiDescription Create New User
 *
 * @apiparam (Header) {string} cognito-token        User Unique Identifier from Cognito
 * @apiparam (body) {string} email                  User Email
 *
 * @apiSuccess (Success Returned JSON) {String}  User is created successfully
 * @apiError return corresponding errors
 */
exports.userCreate = async (req, res) => {
  // Parameter guard
  const numOfParams = Object.keys(req.body).length;
  if (numOfParams > 1) {
    return res.status(400).json({
      errors: [{ msg: 'Bad Request, too many parameters.' }],
    });
  }

  const userSub = req.userSub;

  try {
    // Check if user already exists
    if (req.userId) {
      return res.status(400).json({
        errors: [{ msg: 'The user already registed, Please sign in.' }],
      });
    }

    const email = req.body.email;
    const emailPrefix = email.substring(0, email.lastIndexOf('@'));

    // Check if the email is already used as a existing default user name
    const isUserNameDuplicated = await User.findOne({ userName: emailPrefix });
    const defaultUserName = isUserNameDuplicated
      ? emailPrefix + userSub
      : emailPrefix;

    // Create a new user to save
    let user = new User({
      userId: userSub,
      userName: defaultUserName,
      email,
    });

    // Save to the database
    await user.save();
    res.status(200).json({
      message: 'User account created successfully.',
      user,
    });
  } catch (err) {
    res.status(500).json({ msg: 'Server Error', err: err.message });
  }
};

/**
 * @api {get} /api/v1/user/profile/me GetUserProfile
 * @apiName GetUserProfile
 * @apiGroup User
 * @apiDescription ToC Use | get user's profile
 *
 * @apiSuccess  {Object}  profile   user's profile
 * @apiError return corresponding errors
 */
exports.getUserProfile = async (req, res) => {
  try {
    // Check if user exists
    let user = await User.findById(req.userId);
    if (!user) {
      return res
        .status(400)
        .json({ errors: [{ msg: 'Cannot find the user.' }] });
    }

    /**
     * 1. basic info: userName, etc  (Already retrieved above)
     * ====================
     * 2. vidoes: populate
     * 2.1 uploaded videos
     * 2.2 collected videos
     * 2.3 liked vidoes
     */

    // Populate user's uploaded videos
    user.populate('videos.videoPost');

    // Populate user's video collection
    await User.populate(user, { path: 'collections.videoPost' });
    await User.populate(user, {
      path: 'collections.videoPost.userId',
      select: ['_id', 'userId', 'userName', 'profilePhoto'],
    });
    await User.populate(user, { path: 'collections.videoPost.comments.user' });

    // Populate user's liked video
    await User.populate(user, { path: 'likedVideos.videoPost' });
    await User.populate(user, {
      path: 'likedVideos.videoPost.userId',
      select: ['_id', 'userId', 'userName', 'profilePhoto'],
    });
    await User.populate(user, { path: 'likedVideos.videoPost.comments.user' });

    // User profile retrieved
    res.status(200).send(user);
  } catch (err) {
    res
      .status(500)
      .send({ msg: 'Failed to retrieve user profile.', err: err.message });
  }
};

/**
 * @api {post} /api/v1/user/profile/me UpdateUserProfile
 * @apiName UpdateUserProfile
 * @apiGroup User
 * @apiDescription Change Customer's profile based on user input
 *
 * @apiParam (Body) {String} userName       the new user name to change
 * @apiParam (Body) {String} firstName      new First Name
 * @apiParam (Body) {String} lastName       new Last Name
 *
 * @apiError return corresponding errors
 */
exports.updateProfile = async (req, res) => {
  // Parameter guard
  const numOfParams = Object.keys(req.body).length;
  if (numOfParams > 3) {
    return res.status(400).json({
      errors: [
        { msg: 'Bad Request, too many parameters. Please only 3 params' },
      ],
    });
  }

  const newUserName = req.body.userName;
  const newFirstName = req.body.firstName;
  const newLastName = req.body.lastName;

  try {
    // Check uniquness of UserName
    let user = await User.findOne({ userName: newUserName });
    if (user && user.userId !== req.userSub) {
      return res.status(400).json({
        error: [
          { msg: 'User name already exists, Please try an another name.' },
        ],
      });
    }

    user = await User.findById(req.userId);

    // Update user's profile
    user.userName = newUserName;
    user.firstName = newFirstName;
    user.lastName = newLastName;

    await user.save();
    return res.status(200).json({
      message: 'User profile is updated',
      user,
    });
  } catch (err) {
    res.status(500).json({ msg: 'Failed to update profile', err: err.message });
  }
};

/**
 * @api {post} /api/v1/user/profile/photo UpdateUserProfilePhoto
 * @apiName UpdateUserProfilePhoto
 * @apiGroup User
 * @apiDescription ToC use | update a customer's profile photo
 *
 * @apiBody {File} binary image      the customer's profile photo
 *
 * @apiSuccess  return photo url that is stored on AWS
 * @apiError Sever Error 500 with error message
 */
exports.updateProfilePhoto = async (req, res) => {
  const imageParams = AWS_S3.s3ProfilePhotoParams(req);

  try {
    // Check if user exists
    let user = await User.findById(req.userId);
    if (!user) {
      return res
        .status(400)
        .json({ errors: [{ msg: 'Cannot find the user.' }] });
    }

    // Upload the new profile photo
    const imageStored = await s3
      .upload(imageParams, (err) => {
        if (err) {
          return res.status(500).json({
            errors: [
              {
                msg: 'Error occured while trying to upload image to S3 bucket',
                err,
              },
            ],
          });
        }
      })
      .promise();

    // If a photo already exists, delete the previous one
    if (user.profilePhoto) {
      const delParams = {
        Bucket: config.S3ProfilePhotoBucketName,
        Key: getFileBaseName(user.profilePhoto),
      };

      s3.deleteObject(delParams, function (err) {
        if (err) {
          return res.status(500).json({
            errors: [
              {
                msg: 'Error occured while trying to delete the old profile photo from S3',
                err,
              },
            ],
          });
        }
      });
    }

    const imageFileName = getFileBaseName(imageStored.Location);
    const imageUrl = AWS_S3.profilePhotoUrlGenerator(imageFileName);

    // Update database
    user.profilePhoto = imageUrl;
    await user.save();

    res.status(200).json({
      message: 'User profile photo is updated',
      user,
    });
  } catch (err) {
    res.status(500).json({
      msg: 'Failed to update profile photo',
      err: err.message,
    });
  }
};

/**
 * @api {delete} /api/v1/user/delete UserDelete
 * @apiName UserDelete
 * @apiGroup User
 * @apiDescription Delete The User by email
 *
 * @apiParam (Body) {String} email      the email of the account to be deleted
 *
 * @apiSuccess (Success Returned JSON) {String}  User is deleted successfully
 * @apiError return corresponding errors
 */
exports.userDelete = async (req, res) => {
  const email = req.body.email;

  try {
    /**
     * 1. AWS S3: delete user profile image
     * 2. AWS S3: delete user uploaded videos & cover images
     * 3. Database: delete video posts & user records
     * 4. AWS Cognito: delete user
     */

    // Check if user exists
    let user = await User.findById(req.userId);
    if (!user) {
      return res
        .status(400)
        .json({ errors: [{ msg: 'Cannot find the user.' }] });
    }

    // Delete profile image from S3
    if (user.profilePhoto) {
      let delParams = {
        Bucket: config.S3ProfilePhotoBucketName,
        Key: getFileBaseName(user.profilePhoto),
      };

      s3.deleteObject(delParams, (err) => {
        if (err) {
          return res.status(500).json({
            errors: [
              {
                msg: 'Error occured while trying to delete the old profile photo from S3',
                err,
              },
            ],
          });
        }
      });
    }

    // Delete videos and cover images from S3
    await User.populate(user, {
      path: 'videos',
      populate: {
        path: 'videoPost',
        model: 'VideoPost',
      },
    });

    for (let v of user.videos) {
      const videoPost = v.videoPost;

      let err = AWS_S3.deleteVideoInS3(videoPost.videoUrl);
      if (err) {
        return res.status(500).json({
          errors: [
            {
              msg: 'Error occured while trying to delete the video file from S3',
              err,
            },
          ],
        });
      }

      err = AWS_S3.deleteCoverImageInS3(videoPost.coverImageUrl);
      if (err) {
        return res.status(500).json({
          errors: [
            {
              msg: 'Error occured while trying to delete the cover Image from S3',
              err,
            },
          ],
        });
      }
    }

    // Delete video posts and user from database
    const userObjectId = user._id;
    await VideoPost.deleteMany({ userId: userObjectId });
    await User.deleteOne({ _id: userObjectId });

    // Delete account from Congito
    await adminDeleteUser(email);

    res.status(200).json({
      message: 'User account deleted successfully.',
    });
  } catch (err) {
    res.status(500).json({ msg: 'Server Error', err: err.message });
  }
};

/**
 * @api {post} /api/v1/user/videos/videoCollection/:videoPostId
 * @apiName CollectVideo
 * @apiGroup User
 * @apiDescription Add video into collections
 *
 * @apiParam (params) {String} videoPostId
 *
 * @apiError return corresponding errors
 */
exports.collectVideo = async (req, res) => {
  try {
    // Check if user exists
    let user = await User.findById(req.userId);
    if (!user) {
      return res
        .status(400)
        .json({ errors: [{ msg: 'Cannot find the user.' }] });
    }

    const videoPostId = req.params.videoPostId;

    // Find the video post
    let post = await VideoPost.findById(videoPostId);
    if (!post) {
      return res.status(400).json({
        errors: [{ msg: 'Video post does not exist.' }],
      });
    }

    // Check if the post is alrealy collected by the user
    if (
      user.collections.filter((c) => c.videoPost === videoPostId).length > 0
    ) {
      return res.status(400).json({ msg: 'Already collect this video' });
    }

    // Add the video into collections
    user.collections.push({ videoPost: videoPostId });
    post.countCollections += 1;

    await user.save();
    await post.save();

    await User.populate(user, { path: 'collections.videoPost' });
    const collections = user.collections;

    res.status(200).json({
      message: 'User add video in collection successfully',
      collections,
      post,
    });
  } catch (err) {
    res.status(500).json({
      msg: 'Failed to add video into collections',
      err: err.message,
    });
  }
};

/**
 * @api {delete} /api/v1/user/videos/videoCollection/:videoPostId
 * @apiName DeleteFromCollections
 * @apiGroup User
 * @apiDescription Delete a video post from user's collections
 *
 * @apiParam (params) {String} videoPostId
 *
 * @apiError return corresponding errors
 */
exports.deleteFromCollections = async (req, res) => {
  try {
    // Check if user exists
    let user = await User.findById(req.userId);
    if (!user) {
      return res
        .status(400)
        .json({ errors: [{ msg: 'Cannot find the user.' }] });
    }

    // Find the video post
    const videoPostId = req.params.videoPostId;
    let post = await VideoPost.findById(videoPostId);
    if (!post) {
      return res
        .status(400)
        .json({ errors: [{ msg: 'Video post does not exist.' }] });
    }

    // Find the post in the user's collections
    if (
      user.collections.filter((c) => c.videoPost === videoPostId).length == 0
    ) {
      return res.status(400).json({ msg: 'No video in collections' });
    }

    // Delete the video from collections
    user.collections = user.collections.filter(
      (c) => c.videoPost !== videoPostId,
    );

    if (!post.countCollections || post.countCollections <= 0) {
      return res.status(400).json({ msg: 'No video in collections' });
    }

    post.countCollections -= 1;

    await user.save();
    await post.save();

    await User.populate(user, { path: 'collections.videoPost' });
    const collections = user.collections;

    res.status(200).json({
      message: 'User add video in collection successfully',
      collections,
      post,
    });
  } catch (err) {
    res.status(500).json({
      msg: 'Failed to delete video from collections',
      err: err.message,
    });
  }
};
