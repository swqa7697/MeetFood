const express = require('express');
const router = express.Router();
const UserController = require('../controllers/user');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const { isCognitoAuth } = require('../middleware/is-auth');

// Create user based on Cognito
router.post('/create', isCognitoAuth, UserController.userCreate);

// Get user profile
router.get('/profile/me', isCognitoAuth, UserController.getUserProfile);

// Update profile
router.post('/profile/me', isCognitoAuth, UserController.updateProfile);

// Update profile photo
router.post(
  '/profile/photo',
  upload.single('imageContent'),
  isCognitoAuth,
  UserController.updateProfilePhoto,
);

// Delete user
router.delete('/delete', isCognitoAuth, UserController.userDelete);

// Add Video to collection
router.post(
  '/videos/videoCollection/:videoPostId',
  isCognitoAuth,
  UserController.collectVideo,
);

// Delete Video from collection
router.delete(
  '/videos/videoCollection/:videoPostId',
  isCognitoAuth,
  UserController.deleteFromCollections,
);

module.exports = router;
