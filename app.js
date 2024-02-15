const express = require('express');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const expressValidator = require('express-validator');
const cors = require('cors');
const config = require('./config/production.json');
const port = process.env.PORT || 3000;

// Routes
const userRoutes = require('./routes/user');
const videoRoutes = require('./routes/videopost');

// Express
const app = express();

// Middleware
const MAX_RATE = 2000;
app.use(
  rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour duration in milliseconds
    max: MAX_RATE,
    message: `You exceeded ${MAX_RATE} requests in per hour limit!`,
    headers: true,
  }),
);

app.use(cors());

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
app.use('/api/v1/video', videoRoutes);
app.get('/', function (req, res) {
  res.status(200).json({
    message: 'Successfully access MeetFood API.',
  });
});

// Database
mongoose.set('debug', true);
mongoose
  .connect(config.mongodbConnectURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    dbName: config.dbName,
  })
  .then(() => {
    console.log('Database Connection is ready...');
    app.listen(port, () => {
      console.log(`Server is listening on port ${port}`);
    });
  })
  .catch((err) => {
    console.log(err);
  });

module.exports = app;
