const CognitoExpress = require('cognito-express');
const User = require('../models/user');
const config = require('../config/production.json');

// Initializing CognitoExpress constructor
const cognitoExpress = new CognitoExpress({
  region: config.CognitoRegion,
  cognitoUserPoolId: config.CognitoUserPoolId,
  tokenUse: config.CognitoTokenUse,
  tokenExpiration: config.CognitoTokenExpiration,
});

function isCognitoAuth(req, res, next) {
  const token = req.header('cognito-token');
  if (!token) {
    return res.status(401).send('Access Token not found');
  }

  // Authenticate the token
  cognitoExpress.validate(token, async function (err, response) {
    if (err) {
      return res.status(401).json({ err });
    }

    // Token has been authenticated. Proceed info to the API
    req.userSub = response.sub;
    let user = await User.findOne({ userId: response.sub });

    if (user) {
      req.userId = user._id;
    } else {
      req.userId = null;
    }

    next();
  });
}

function isCognitoAuthOpt(req, res, next) {
  const token = req.header('cognito-token');

  // No token -> no authentication required
  if (!token) {
    next();
    return;
  }

  // Token exists. Proceed info to the API
  cognitoExpress.validate(token, function (err, response) {
    if (err) {
      return res.status(401).json({ err });
    }

    req.userSub = response.sub;
    next();
  });
}

module.exports = {
  isCognitoAuth,
  isCognitoAuthOpt,
};
