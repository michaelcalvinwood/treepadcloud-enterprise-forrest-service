const httpsPort = 6102;
const privateKeyPath = '/home/keys/treepadcloud.com.key';
const fullchainPath = '/home/keys/treepadcloud.com.pem';

/*
 * Utility requirements
 */
const process = require('process');
const fs = require('fs');
require('dotenv').config();

/*
 * Global Constants
 */

const JwtSecretKey = process.env.JWT_SECRET_KEY;
const EywaPassword = process.env.EYWA_PASSWORD;

/*
 * Express server requirements
 */
const express = require('express');
const https = require('https');
const http = require('http');
const cors = require('cors');

/*  
 * Redis requirements
 */

const { createClient } = require("redis");

/*
 * MongoDB requirements
 */
const mongo = require('mongodb');

/*
 * Socket.io requirements
 */
const socketio = require('socket.io');
const { createAdapter } = require("@socket.io/redis-adapter");

/*
 * JWT Requirements
 */
const jwt = require('jsonwebtoken');
const bcrypt = require("bcrypt");


/*
 * Configure express https service
 */
const app = express();
app.use(express.static('public'));
app.use(express.json({limit: '200mb'})); 
app.use(cors());

/*
 * App Functions
 */
let window = {};
window.token = {};

const handleToken = (socket, token) => {
  console.log('token', token, socket.id);

  let tokenVerification = false;
  try {
      tokenVerification = jwt.verify(token.signed, JwtSecretKey);
  } catch (e) {
      console.error(e);
      return socket.emit('message', {msg: "Error trying to validate user token."});
  }

  const info = jwt.decode(token.signed);

  const { exp } = info;

  const curTime = Date.now();
  const expiration = exp * 1000;

  console.log('compare', curTime, expiration);

  if (curTime >= expiration) {
      return socket.emit('message', {
        msg: "Login session has expired. Please login again.",
        action: 'reset'
      })
  }

  /*
   * Set the token to the decoded info to ensure integrity
   */

  window.token[socket.id] = info;
  socket.emit('message', {msg: "Token authenticated"});
}

const isAuthenticated = (socket, resourceName) => {
  const id = socket.id;
  // check window.token.id to see if userName = resourceName
    // if yes, return true
  
  // extract userName from resourceName

  // check window.token.id to see if userName = extracted resourceName
    // if yes, return true
  
  // check window.token.id to see if userName = resourceName
    // if yes, return true
    
  // check permissions array to see socket has permissions for resource or its ancestors
    // if yes return true

  return false;
}

const cleanUpSocket = socket => {
  console.log('cleanUpSocket', socket.id);
  if (window.token[socket.id]) delete window.token[socket.id];

}

const handleSocket = socket => {
  console.log('handleSocket');
  socket.on('disconnect', () => cleanUpSocket(socket));
  socket.on('token', token => handleToken(socket, token));
}

/*
 * Create Express HTTPS Service
 */

app.get('/', (req, res) => {
    res.send('Hello, World!');
});

const httpsServer = https.createServer({
    key: fs.readFileSync(privateKeyPath),
    cert: fs.readFileSync(fullchainPath),
  }, app);
  

  httpsServer.listen(httpsPort, () => {
    console.log(`HTTPS Server running on port ${httpsPort}`);
});

/*
 * Create Eywa Pub/Sub
 * https://github.com/redis/node-redis/blob/master/docs/client-configuration.md
 */

const eywaPubClient = createClient({
  socket: {
    host: 'eywa.treepadcloud.com',
    port: 6379
  },
  password: EywaPassword
});
const eywaSubClient = eywaPubClient.duplicate();

/*
 * Create socket.io service
 */

const io = socketio(httpsServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
io.adapter(createAdapter(eywaPubClient, eywaSubClient));
io.on('connection', (socket) => handleSocket(socket));

/*
 * Create MongoDB service
 */

const mongoUrl = 'mongodb://127.0.0.1:27017/';
const mongoClient = mongo.MongoClient;

mongoClient.connect('mongodb://127.0.0.1:27017/treepadcloud_forrest',{
    useNewUrlParser: true, 
    useUnifiedTopology: true
})
.then(db => console.log('Mongo DB is connected'))
.catch(err => console.log(err));

