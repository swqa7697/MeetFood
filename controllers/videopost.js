const mongoose = require('mongoose');
const fs = require('fs');
const VideoPost = require('../models/videopost');
const User = require('../models/user');
const { getFileBaseName } = require('../util/path');
const { getPagination, getSortOption } = require('../util/posts-pagination');
const AWS_S3 = require('../util/aws-s3');
const s3 = AWS_S3.setS3Credentials;

/**
 * @api {get} /api/v1/video/:videoPostId GetVideoPost
 * @apiName GetVideoPost
 * @apiGroup VideoPost
 * @apiDescription Get a videoPost with the videoPostId
 *
 * @apiParam {String} videoPostId
 *
 * @apiSuccess  {Object} videoPost  the videoPost
 * @apiError Sever Error 500 with error message
 */
exports.getVideoPost = async (req, res) => {
  try {
    let videoPost = await VideoPost.findById(req.params.videoPostId)
      .populate('comments.user')
      .exec();

    // Check if video post exists
    if (!videoPost) {
      return res.status(404).json({
        msg: 'Cannot find the post with this videoPostId.',
      });
    }

    // Retrieve comments
    let newComments = videoPost.comments.map((c) => {
      return {
        user: c.user._id,
        text: c.text,
        name: c.user.userName,
        avatar: c.user.profilePhoto,
        date: c.date,
      };
    });

    videoPost.comments = newComments;
    res.status(200).json(videoPost);
  } catch (err) {
    res.status(500).json({ err: err.message });
  }
};

/**
 * @api {post} /api/v1/video/comment/:videoPostId PostComment
 * @apiName PostComment
 * @apiGroup VideoPost
 * @apiDescription create a comment for a video post
 *
 * @apiParam {String} videoPostId
 * @apiparam (body) {string} text
 * *
 * @apiError Sever Error 500
 */
exports.postComment = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    let post = await VideoPost.findById(req.params.videoPostId);
    if (!post) {
      return res.status(404).json({
        msg: 'Cannot find the post.',
      });
    }

    const newComment = {
      user: user._id,
      text: req.body.text,
    };

    post.comments.unshift(newComment);
    post.countComment = post.comments.length;

    await post.save();

    res.status(200).json({
      message: 'Comment added successfully',
      post,
    });
  } catch (err) {
    res.status(500).json({ msg: 'Server Error', err: err.message });
  }
};

/**
 * @api {delete} /api/v1/video/comment/:videoPostId/:commentId  DeleteComment
 * @apiName DeleteComment
 * @apiGroup VideoPost
 * @apiDescription delete a comment for a video post
 *
 * @apiParam {String} videoPostId
 * @apiParam {String} commentId
 *
 * @apiError Sever Error 500
 */
exports.deleteComment = async (req, res) => {
  try {
    let post = await VideoPost.findById(req.params.videoPostId);
    if (!post) {
      return res.status(404).json({
        msg: 'Post does not exist.',
      });
    }

    const comment = post.comments.find(
      (c) => c._id.toString() === req.body.commentId.toString(),
    );
    if (!comment) {
      return res.status(404).json({ msg: 'Comment does not exist.' });
    }

    // Check if the comment is wroten by the user
    if (comment.user.toString() !== req.userId.toString()) {
      return res.status(401).json({ msg: 'The user is not authorized.' });
    }

    // Delete from conmments array
    const removeIndex = post.comments
      .map((c) => c._id)
      .indexOf(req.params.commentId);
    post.comments.splice(removeIndex, 1);
    post.countComment = post.comments.length;

    await post.save();

    res.sendStatus(200);
  } catch (err) {
    res.status(500).json({ msg: 'Server Error', err: err.message });
  }
};

/**
 * @api {get} /api/v1/video/videos  FetchVideoPosts
 * @apiName FetchVideoPosts
 * @apiGroup VideoPost
 * @apiDescription ToC use | Get videos, including customer's videos and business videos (login is optional)
 *
 * @apiQuery sortBy    sort video posts by a field. Ex. 'distance', 'popularity'
 * @apiQuery sortOrder sort order. 1 means ascend, -1 means descend
 * @apiQuery page      the page number
 * @apiQuery size      how many products we want to query
 * @apiQuery distance  filter by distance(mile), default is 50
 *
 * @apiSuccess  {Object[]} vidoes  Array of videos
 * @apiError Sever Error 500 with error message
 */
exports.fetchVideoPosts = async (req, res) => {
  const { page, size } = req.query;
  const { limit, offset } = getPagination(page, size);
  const sort = getSortOption(req.query);

  try {
    const videoPosts = await VideoPost.aggregate([
      {
        $addFields: {
          popularity: {
            $add: [
              { $multiply: [0.7, '$countCollections'] },
              { $multiply: [0.3, '$countLike'] },
            ],
          },
        },
      },
      { $sort: sort },
      { $skip: offset },
      { $limit: limit },
    ]);

    // Populate info of author
    await VideoPost.populate(videoPosts, {
      path: 'userId',
      select: ['_id', 'userId', 'userName', 'profilePhoto'],
    });

    // Populate info of comment senders
    await VideoPost.populate(videoPosts, {
      path: 'comments.user',
    });
    videoPosts.map((post) => {
      let newComments = post.comments.map((c) => {
        // handle account deletion case
        if (!c.user) {
          return {
            user: '',
            text: c.text,
            name: 'Deleted Account',
            avatar: '',
            date: c.date,
          };
        } else {
          return {
            user: c.user._id,
            text: c.text,
            name: c.user.userName,
            avatar: c.user.profilePhoto,
            date: c.date,
          };
        }
      });
      post.comments = newComments;
    });

    res.status(200).json(videoPosts);
  } catch (err) {
    return res.status(500).json({
      errors: [
        {
          msg: 'Error loading videoPosts.',
          err: err.message,
        },
      ],
    });
  }
};

/**
 * @api {put} /api/v1/video/like/:videoPostId LikeVideoPost
 * @apiGroup VideoPost
 * @apiName LikeVideoPost
 * @apiDescription ToC use | used for users to like a videoPost; also, one user can only like one time for a videoPost
 *
 * @apiParam {String} videoPostId
 *
 * @apiSuccess  {Object} Success message
 * @apiError (Error 500) Sever error message
 */
exports.likeVideoPost = async (req, res) => {
  try {
    // Check if user exists
    const user = await User.findById(req.userId);
    if (!user) {
      return res
        .status(400)
        .json({ errors: [{ msg: 'Cannot find the user.' }] });
    }

    const videoPostId = req.params.videoPostId;

    // Check if video post exists
    let post = await VideoPost.findById(videoPostId);
    if (!post) {
      return res.status(404).json({
        msg: 'Post does not exist.',
      });
    }

    // Check if the post is alrealy liked by the user
    if (
      post.likes.find(
        (like) => like.user && like.user.toString() === req.userId.toString(),
      )
    ) {
      return res.status(400).json({ msg: 'Already liked this post' });
    }

    post.likes.unshift({ user: req.userId });
    post.countLike = post.likes.length;
    user.likedVideos.push({ videoPost: videoPostId });

    await post.save();
    await user.save();

    res.sendStatus(200);
  } catch (err) {
    res.status(500).json({ msg: 'Server Error', err: err.message });
  }
};

/**
 * @api {put} /api/v1/video/unlike/:videoPostId  UnlikeVideoPost
 * @apiGroup VideoPost
 * @apiName UnlikeVideoPost
 * @apiGroup VideoPost
 * @apiDescription toC use | used for users to unlike a videoPost;
 *
 * @apiParam {String} videoPost Id
 *
 * @apiSuccess  {Object} Success message
 * @apiError (Error 500) Sever error message
 */
exports.unlikeVideoPost = async (req, res) => {
  try {
    // Check if user exists
    const user = await User.findById(req.userId);
    if (!user) {
      return res
        .status(400)
        .json({ errors: [{ msg: 'Cannot find the user.' }] });
    }

    const videoPostId = req.params.videoPostId;

    // Check if video post exists
    let post = await VideoPost.findById(videoPostId);
    if (!post) {
      return res.status(404).json({
        msg: 'Post does not exist.',
      });
    }

    // Check if the post is alrealy liked by the user
    // If the likes array contains the the id of current logged-in user, allow unlike
    const removeIndex = post.likes.map((like) => like.user).indexOf(req.userId);
    if (removeIndex === -1) {
      return res.status(400).json({ msg: 'Have not liked this post yet' });
    }

    post.likes.splice(removeIndex, 1);
    post.countLike = post.likes.length;
    user.likedVideos = user.likedVideos.filter(
      (p) => p.videoPost !== videoPostId,
    );

    await post.save();
    await user.save();

    res.sendStatus(200);
  } catch (err) {
    res.status(500).json({ msg: 'Server Error', err: err.message });
  }
};

/**
 * @api {post} /api/v1/video/coverImage     UploadCoverImage
 * @apiName UploadCoverImage
 * @apiGroup VideoPost
 * @apiDescription ToC use | Update a image file. Upload video cover image to AWS.
 *
 * @apiBody {File} binary image File        The image to upload
 *
 * @apiSuccess  return photo url that is stored on AWS
 * @apiError Sever Error 500 with error message
 */
exports.uploadCoverImage = async (req, res) => {
  try {
    // Check if user exists
    const user = await User.findById(req.userId);
    if (!user) {
      return res
        .status(400)
        .json({ errors: [{ msg: 'Cannot find the user.' }] });
    }

    // Upload the image file
    const imageParams = AWS_S3.s3CoverImageParams(req);
    const imageStored = await s3
      .upload(imageParams, (error) => {
        if (error) {
          // Clear uploaded image file
          fs.unlinkSync(req.file.path);

          return res.status(500).json({
            errors: [
              {
                msg: 'Error occured while trying to upload image to S3 bucket',
                error,
              },
            ],
          });
        }
      })
      .promise();

    // Clear uploaded image file
    fs.unlinkSync(req.file.path);

    const imageFileName = getFileBaseName(imageStored.Location);
    const imageUrl = AWS_S3.coverImageUrlGenerator(imageFileName);

    res.status(200).json({
      message: 'Image is uploaded successfully',
      imageUrl,
    });
  } catch (err) {
    // Clear uploaded image file
    fs.unlinkSync(req.file.path);

    res.status(500).json({ msg: 'Failed to upload image', err: err.message });
  }
};

/**
 * @api {post} /api/v1/video/upload    UploadVideo
 * @apiName UploadVideo
 * @apiGroup VideoPost
 * @apiDescription ToC use | Update a single video file. Upload the video file to AWS
 *
 * @apiBody {File} binary video File   the video to upload
 *
 * @apiSuccess  return video url that is stored on AWS
 * @apiError Sever Error 500 with error message
 */
exports.uploadVideo = async (req, res) => {
  try {
    // Check if user exists
    const user = await User.findById(req.userId);
    if (!user) {
      return res
        .status(400)
        .json({ errors: [{ msg: 'Cannot find the user.' }] });
    }

    // Upload the video file
    const videoParams = AWS_S3.s3VideoParams(req);
    const videoStored = await s3
      .upload(videoParams, (error) => {
        if (error) {
          // Clear uploaded video file
          fs.unlinkSync(req.file.path);

          return res.status(500).json({
            errors: [
              {
                msg: 'Error occured while trying to upload video to S3 bucket',
                error,
              },
            ],
          });
        }
      })
      .promise();

    // Clear uploaded video file
    fs.unlinkSync(req.file.path);

    const videoFileName = getFileBaseName(videoStored.Location);
    const videoUrl = AWS_S3.videoUrlGenerator(videoFileName);

    res.status(200).json({
      message: 'Video is uploaded successfully',
      videoUrl,
    });
  } catch (err) {
    // Clear uploaded video file
    fs.unlinkSync(req.file.path);

    res.status(500).json({ msg: 'Failed to upload video', err: err.message });
  }
};

/**
 * @api {post} /api/v1/video/new     CreateVideoPost
 * @apiName CreateVideoPost
 * @apiGroup VideoPost
 * @apiDescription ToC use | Create customer video post
 *
 * @apiBody {String} postTitle                the name of the video post
 * @apiBody {String} imageUrl                 the cover image of the video post
 * @apiBody {String} videoUrl                 the video url
 * @apiBody {String} restaurantName           the name of the restaurant
 * @apiBody {String} orderedVia               the way the dish or video is obtained
 * @apiBody {Address} restaurantAddress       the restaurant's address
 *
 * @apiSuccess  return video url as well as the updated user object
 * @apiError Sever Error 500 with error message
 */
exports.createVideoPost = async (req, res) => {
  // Request body validation
  req
    .checkBody('postTitle')
    .exists()
    .withMessage('post Title is required')
    .notEmpty()
    .withMessage('post Title is required');
  req
    .checkBody('imageUrl')
    .exists()
    .withMessage('imageUrl is required')
    .notEmpty()
    .withMessage('Empty URL');
  req
    .checkBody('videoUrl')
    .exists()
    .withMessage('videoUrl is required')
    .notEmpty()
    .withMessage('Empty URL');
  req
    .checkBody('restaurantName')
    .notEmpty()
    .withMessage('Restaurant name should not be empty');

  const errors = req.validationErrors();
  if (errors && errors.length > 0) {
    return res.status(400).json({ errors: errors });
  }

  const {
    postTitle,
    imageUrl,
    videoUrl,
    restaurantName,
    restaurantAddress,
    orderedVia,
  } = req.body;

  try {
    // Check if user exists
    const user = await User.findById(req.userId);
    if (!user) {
      return res
        .status(400)
        .json({ errors: [{ msg: 'Cannot find the user.' }] });
    }

    const session = await mongoose.startSession();

    let videoPost;
    await session
      .withTransaction(async () => {
        videoPost = new VideoPost({
          postTitle: postTitle,
          userId: user._id,
          videoUrl: videoUrl,
          coverImageUrl: imageUrl,
          restaurantName: restaurantName,
          restaurantAddress: restaurantAddress,
          orderedVia: orderedVia,
          postTime: new Date().toISOString(),
        });

        videoPost = await videoPost.save();

        user.videos.push({ videoPost: videoPost._id });
        await user.save();
      })
      .catch((err) => {
        session.endSession();
        console.log(err.message);
        throw err;
      });

    session.endSession();

    res.status(200).json({
      message: 'Video post is created successfully',
      videoPost,
    });
  } catch (err) {
    res.status(500).json({
      msg: 'Failed to create video post',
      err: err.message,
    });
  }
};

/**
 * @api {delete} /api/v1/video/customer/:videoPostId    DeleteVideoPost
 * @apiName DeleteVideoPost
 * @apiGroup VideoPost
 * @apiDescription ToC Use | Delete a videoPost with the videoPostId
 *
 * @apiParam {String} videoPost Id
 *
 * @apiError Sever Error 500 with error message
 */
exports.deleteVideoPost = async (req, res) => {
  try {
    const videoPostId = req.params.videoPostId;

    // Check if video post exists
    const post = await VideoPost.findById(videoPostId);
    if (!post) {
      return res.status(404).json({
        msg: 'Post does not exist.',
      });
    }

    // Get video url and cover image url
    const videoUrl = post.videoUrl;
    const coverImageUrl = post.coverImageUrl;

    // Check ownership of the video post
    let user = await User.findById(req.userId);

    if (!user) {
      return res
        .status(400)
        .json({ errors: [{ msg: 'Cannot find the user.' }] });
    }

    if (user._id.toString() !== post.userId.toString()) {
      return res.status(401).json({
        msg: 'No matching video found under user record.',
      });
    }

    // Delete video post from videoPost collection (Database)
    await VideoPost.deleteOne({ _id: videoPostId });

    // Delete video post from User document (Database)
    user.videos = user.videos.filter(
      (v) => v.videoPost.toString() !== videoPostId,
    );
    await user.save();

    // Delete cover image from AWS
    let error = AWS_S3.deleteCoverImageInS3(coverImageUrl);
    if (error) {
      return res.status(500).json({
        errors: [
          {
            msg: 'Error occured while trying to delete the cover Image from S3',
            error,
          },
        ],
      });
    }

    // Delete video file from AWS
    error = AWS_S3.deleteVideoInS3(videoUrl);
    if (error) {
      return res.status(500).json({
        errors: [
          {
            msg: 'Error occured while trying to delete the video file from S3',
            error,
          },
        ],
      });
    }

    res.status(200).json({
      msg: 'The video post is deleted successfully and its corresponding user record updated as well.',
    });
  } catch (err) {
    res.status(500).json({ err: err.message });
  }
};
