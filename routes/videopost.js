const express = require('express');
const router = express.Router();
const VideoPostController = require('../controllers/videopost');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const { isCognitoAuth, isCognitoAuthOpt } = require('../middleware/is-auth');

// Fetch a page of video posts
router.get('/videos', isCognitoAuthOpt, VideoPostController.fetchVideoPosts);

// Get a video post by videoPostId
router.get('/:videoPostId', isCognitoAuth, VideoPostController.getVideoPost);

// Add a comment to a video post
router.post(
  '/comment/:videoPostId',
  isCognitoAuth,
  VideoPostController.postComment,
);

// Delete a comment from a video post
router.delete(
  '/comment/:videoPostId/:commentId',
  isCognitoAuth,
  VideoPostController.deleteComment,
);

// Like a video post
router.put(
  '/like/:videoPostId',
  isCognitoAuth,
  VideoPostController.likeVideoPost,
);

// Unlike a video post
router.put(
  '/unlike/:videoPostId',
  isCognitoAuth,
  VideoPostController.unlikeVideoPost,
);

// Upload a new cover image file
router.post(
  '/coverImage',
  isCognitoAuth,
  upload.single('cover-image'),
  VideoPostController.uploadCoverImage,
);

// Upload a new video file
router.post(
  '/upload',
  isCognitoAuth,
  upload.single('video-content'),
  VideoPostController.uploadVideo,
);

// Create new video post
router.post('/new', isCognitoAuth, VideoPostController.createVideoPost);

// Delete a video post by videoPostId
router.delete(
  '/customer/:videoPostId',
  isCognitoAuth,
  VideoPostController.deleteVideoPost,
);

module.exports = router;
