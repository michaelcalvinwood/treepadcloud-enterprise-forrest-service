const httpsPort = 6102;
const privateKeyPath = '/home/keys/treepadcloud.com.key';
const fullchainPath = '/home/keys/treepadcloud.com.pem';

/*
 * Utility requirements
 */
const process = require('process');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

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

const emit = (socket, msg, data) => {
  const debug = true;
  if (debug) console.log('emit', msg, JSON.stringify(data, null, 4));
  socket.emit(msg, data);
}
const sendMessage = (socket, msg) => emit(socket, 'message', {msg});

const handleToken = (socket, token) => {
  console.log('handleToken', token, socket.id);

  return new Promise((resolve, reject) => {
    let tokenVerification = false;
    try {
        tokenVerification = jwt.verify(token.signed, JwtSecretKey);
    } catch (e) {
        console.error(e);
        socket.emit('message', {msg: "Error trying to validate user token."});
        resolve('error');
        return;
    }

    const info = jwt.decode(token.signed);

    const { exp } = info;

    const curTime = Date.now();
    const expiration = exp * 1000;

    console.log('compare', curTime, expiration);

    if (curTime >= expiration) {
        
        socket.emit('message', {
          msg: "Login session has expired. Please login again.",
          action: 'reset'
        });
        resolve('error');
        return;
    }

    /*
    * Set the token to the decoded info to ensure integrity
    */

    window.token[socket.id] = info;
    socket.emit('message', {msg: "Token authenticated"});
    resolve('ok');
  })
  
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

const mongoInsertOne = (socket, collection, document) => {
  return new Promise((resolve, reject) => {
    mongoDbO.collection(collection).insertOne(document)
    .then(res => resolve(res))
    .catch(err => {
      console.error(err);
      sendMessage(socket, 'Database Error: Could not insert document.');
      resolve('error');
    })
  })
}

const mongoPush = (socket, collection, documentId, arrayName, element) => {
  return new Promise((resolve, reject) => {
    let $push = {};
    $push[arrayName] = element;
    let options = {};
    options["$push"] = $push;
    
    mongoDbO.collection(collection).updateOne({_id: documentId}, options)
    .then(res => resolve(res))
    .catch(err => {
      console.error(err);
      sendMessage(socket, 'Database Error: Could not update document.');
      resolve('error');
    })
  })
}

const createUser = (socket, userName) => {
  return new Promise (async (resolve, reject) => {
    await mongoInsertOne(socket, 'users', {
      _id: userName,
      trees: []
    })
    resolve('ok');
  })
}

const addTree = (socket, userName) => {
  return new Promise(async (resolve, reject) => {
    treeId = `T-${userName}-${uuidv4()}`;
    
    let res;
    try {
      res = await mongoDbO.collection('users').insertOne({
        _id: userName,
        trees: [treeId]
      })
    } catch (e) {
      console.error(e);
      sendMessage(socket, `Database error: Could not create user document.`);
      return resolve('ok');
    }

    branchId = `B-${userName}-${uuidv4()}`;
    try {
      res = await mongoDbO.collection('trees').insertOne({
        _id: treeId,
        icon,
        name: treeName,
        desc: treeDesc,
        branches: [
          {
            branchId,
          }
        ]
      })
    } catch (e) {
      console.error(e);
      sendMessage(socket, `Databasse error: Could not create trees document.`);
      return resolve('ok');
    }

    try {
      res = await mongoDbO.collection('branches').insertOne({
        _id: branchId,
        level: 0,
        name: '',
        parent: null,
        children: []
      })
    } catch (e) {
      console.error(e);
      sendMessage(socket, `Databasse error: Could not create branches document.`);
      return resolve('ok');
    }

    console.log(`Create user document for ${userName}`);
    resolve('ok');
  })
}

const findTreeIds = async userName => {
  let res;
  try {
    res = await mongoDbO.collection('users').find({_id : userName});

  } catch (e) {
    console.error(e);
    sendMessage(socket, 'Database error finding user ' + userName);
    return resolve('ok');
  }

  let userDoc = await res.toArray();
  let treeIds = userDoc[0].trees;

  
  console.log('treeIds', treeIds);

  return treeIds;
}

const createTree = (socket, info) => {
  const { icon, treeName, treeDesc, userName } = info;

  return new Promise(async (resolve, reject) => {
    console.log('createTree', info);

    // check to see if the user already has a tree by that name
    const treeIds = await findTreeIds(userName);

    let treeId = null;
    let branchId = null;

    if (!treeIds.length) {
      await createUser(socket, userName);
    } else {
      // addTree(socket, userName, icon, treeName, treeDesc)
    }

    sendMessage(socket, `Tree ${info.treeName} created.`);
    resolve('ok');
  })
}

const findTreeInfo = async treeId => {
  const debug = true;
  let res;
  try {
    if (debug) console.log(`findTreeInfo: db.trees.find({_id: '${treeId}'})`);
    res = await mongoDbO.collection('trees').find({_id : treeId});
  } catch (e) {
    console.error('findTreeInfo', e);
    sendMessage(socket, 'Database error finding tree ' + treeId);
    return resolve('ok');
  }

  let treeInfo = await res.toArray();

  if (debug) console.log('findTreeInfo treeInfo', treeInfo);

  return treeInfo;
}

const getTrees = (socket, info) => {
  const debug = true;
  if (debug) console.log('getTrees', info);
  return new Promise(async (resolve, reject) => {
    const { userName } = info;
    const treeIds = await findTreeIds(userName);
    if (debug) console.log('getTrees treeIds', treeIds);
    let trees = [];
    for (let i = 0; i < treeIds.length; ++i) {
      const treeInfo = await findTreeInfo(treeIds[i]);
      console.log('getTrees treeInfo', treeInfo);
      trees.push(treeInfo);
    }
    
    console.log('getTrees trees', trees);
    emit(socket, 'getTrees', trees);
    resolve('ok');
  })
}

const handleSocket = socket => {
  console.log('handleSocket');
  socket.on('disconnect', () => cleanUpSocket(socket));
  socket.on('token', token => handleToken(socket, token));
  socket.on('createTree', info => createTree(socket, info));
  socket.on('getTrees', (info) => getTrees(socket, info));
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
let mongoDb = null;
let mongoDbO = null;

const createDbCollection = name => {
  return new Promise((resolve, reject) => {
   
    mongoDbO.createCollection(name)
    .then(res => {
      console.log(`created collection ${name}`);
      return resolve('ok');
    })
    .catch(err => {
      console.log(`collection ${name} already exists`);
      return resolve('ok');
    })
  })
}

mongoClient.connect('mongodb://127.0.0.1:27017/treepadcloud_forrest',{
    useNewUrlParser: true, 
    useUnifiedTopology: true
})
.then(db => {
  console.log('Mongo DB is connected')
  mongoDb = db;
  mongoDbO = mongoDb.db('treepadcloud_forrest');
  return createDbCollection('users')
})
.then(res => createDbCollection('trees'))
.then(res => createDbCollection('branches'))
.then(res => createDbCollection('leaves'))
.catch(err => console.log(err));

