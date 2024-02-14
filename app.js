const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const config = require('./config/production.json');
const port = process.env.PORT || 3000;
const expressValidator = require('express-validator');

mongoose.set('debug', true);

// Routes
const userRoutes = require('./routes/user');

const app = express();

// Middleware
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(bodyParser.urlencoded({ extended: false }));
app.use(expressValidator());

// Add routers
app.use('/api/v1/user', userRoutes);
app.get('/', function (req, res) {
  res.status(200).json({
    message: 'Successfully access MeetFood API.',
  });
});

// Database
mongoose
  .connect(config.mongodbConnectURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    dbName: config.dbName,
  })
  .then(() => {
    console.log('Database Connection is ready...');
    app.listen(port);
  })
  .catch((err) => {
    console.log(err);
  });

module.exports = app;
