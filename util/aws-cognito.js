const aws = require('aws-sdk');
const config = require('../config/production.json');

const adminDeleteUser = async (email) => {
  try {
    const cognito = new aws.CognitoIdentityServiceProvider();
    await cognito
      .adminDeleteUser({
        Username: email,
        UserPoolId: config.CognitoUserPoolId,
      })
      .promise();

    return {
      isDeleted: true,
    };
  } catch (err) {
    return {
      isDeleted: false,
      err: err,
    };
  }
};

module.exports = { adminDeleteUser };
