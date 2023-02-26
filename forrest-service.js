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
    //socket.emit('message', {msg: "Token authenticated"});
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
  const debug = true;
  if (debug) console.log('mongoInsertOne', collection, document);
  return new Promise((resolve, reject) => {
    mongoDbO.collection(collection).insertOne(document)
    .then(res => resolve(res))
    .catch(err => {
      console.error(err);
      sendMessage(socket, 'Database Error: Could not insert document for collection ' + collection);
      resolve('error');
    })
  })
}

const mongoUpdateOne = async (socket, collection, query, update) => {
  const debug = true;
  if (debug) console.log('mongoUpdateOne', collection, query, update);
  await mongoDbO.collection(collection).updateOne(query, update)
  .then (res => true)
  .catch(err => {
      console.error(err);
      sendMessage(socket, 'mongoUpdateOne: ' + err.err);
      return false;
  })
}

const mongoUpdate = async (socket, collection, query, update) => {
  const debug = true;
  if (debug) console.log('mongoUpdate', collection, query, update);
  await mongoDbO.collection(collection).updateOne(query, update)
  .then (res => true)
  .catch(err => {
      console.error(err);
      sendMessage(socket, 'mongoUpdateOne: ' + err.err);
      return false;
  })
}

const mongoDeleteOne = async (socket, collection, query) => {
  const debug = true;
  if (debug) console.log('mongoDeleteOne', collection, query);
  await mongoDbO.collection(collection).deleteOne(query)
  .then (res => true)
  .catch(err => {
      console.error(err);
      sendMessage(socket, 'mongoUpdateOne: ' + err.err);
      return false;
  })
}

const mongoFindOne = async (socket, collection, query) => {
  const debug = true;
  if (debug) console.log('mongoFindOne', collection, query);
  return new Promise(async (resolve, reject) => {
    await mongoDbO.collection(collection).findOne(query)
    .then (res => {
      resolve(res);
      return res;
    })
    .catch(err => {
        console.error(err);
        sendMessage(socket, 'mongoUpdateOne: ' + err.err);
        resolve(false);
        return false;
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

const addTree = (socket, info) => {
  const debug = true;
  if (debug) console.log('addTree', info);
  const { userName, treeName, treeDesc, icon } = info;

  return new Promise(async (resolve, reject) => {
    branchId = `B-${userName}-${uuidv4()}`;
    await mongoInsertOne(socket, 'branches', {
      _id: branchId,
      name: '',
      modules: [],
      activeModule: null
    })
   
    treeId = `T-${userName}-${uuidv4()}`;
    await mongoInsertOne(socket, 'trees', {
      _id: treeId,
      icon,
      name: treeName,
      desc: treeDesc,
      branches: [
        {
          branchId,
          level: 0
        }
      ]
    })
    
    await mongoUpdateOne(socket, 'users', {_id: userName}, {$push: {trees: treeId}});
    return resolve('ok');
  })
}

const findTreeIds = async userName => {
  const debug = false;
  let res;
  try {
    res = await mongoDbO.collection('users').find({_id : userName});

  } catch (e) {
    console.error(e);
    sendMessage(socket, 'Database error finding user ' + userName);
    return resolve('ok');
  }

  let userDoc = await res.toArray();
  let treeIds = userDoc.length ? userDoc[0].trees : [];

  if (debug) console.log('treeIds', treeIds);

  return treeIds;
}

const createTree = (socket, info) => {
  const debug = true;
  const { icon, treeName, treeDesc, userName } = info;

  return new Promise(async (resolve, reject) => {
    if (debug) console.log('createTree', info);

    // check to see if the user already has a tree by that name
    const user = await mongoFindOne(socket, 'users', {_id: userName});
    if (debug) console.log('createTree user', user);

    if (!user) await createUser(socket, userName);

    await addTree(socket, info);
    getTrees(socket, info);

    sendMessage(socket, `Tree ${info.treeName} created.`);
    resolve('ok');

    return;
  })
}

const findTreeInfo = async treeId => {
  const debug = false;
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
  const debug = false;
  if (debug) console.log('getTrees', info);
  return new Promise(async (resolve, reject) => {
    const { userName } = info;
    const treeIds = await findTreeIds(userName);
    if (debug) console.log('getTrees treeIds', treeIds);
    let trees = [];
    for (let i = 0; i < treeIds.length; ++i) {
      const treeInfo = await findTreeInfo(treeIds[i]);
      console.log('getTrees treeInfo', treeInfo);
      trees.push(treeInfo[0]);
    }
    
    console.log('getTrees trees', trees);
    emit(socket, 'getTrees', trees);
    resolve('ok');
  })
}

const setBranchName = (socket, info) => {
  const debug = true;
  if (debug) console.log('setBranchName', info);

  return new Promise(async (resolve, reject) => {
    await mongoUpdateOne(socket, 'branches', {_id: info.id}, {$set: {name: info.name}})
  })
}

const getBranchName = (socket, info) => {
  const debug = true;
  if (debug) console.log('getBranchName', info);
  return new Promise(async (resolve, reject) => {
    let res = await mongoFindOne(socket, 'branches', {_id: info.id});
    if (res) {
      emit(socket, 'getBranchName', {id: info.id, name: res.name});
    }
  })
}

const deleteTree = (socket, info) => {
  const debug = false;
  if (debug) console.log('deleteTree', info);
  return new Promise(async (resolve, reject) => {
    const {treeId, userName} = info;
    const tree = await mongoFindOne(socket, 'trees', {_id: treeId});
    if (debug) console.log('deleteTree tree', tree);

    // remove treeId from user
    await mongoUpdate(socket, 'users', {_id: userName}, {$pull : {trees: treeId}})

    const branches = tree.branches;
    for (let i = 0; i < branches.length; ++i) {
      // retrieve branch info
        //foreach leaf delete
        
        // delete branch
        await mongoDeleteOne(socket, 'branches', {_id: branches[i].branchId})
      }

      // delete tree
      await mongoDeleteOne(socket, 'trees', {_id: treeId});

      getTrees(socket, info);
  })
}

const setActiveModule = (socket, info) => {
  const debug = true;
  console.log('setActiveModule', info);
  const { userName, moduleId, branchId } = info;
  const leafId = 'L' + branchId + '-' + moduleId;

  return new Promise(async (resolve, reject) => {
    await mongoUpdateOne(socket, 'branches', {_id: branchId}, {$addToSet: { modules: moduleId}, $set: {activeModule: leafId}});

    const leaf = await mongoFindOne(socket, 'leaves', {_id: leafId});
    if (!leaf) await mongoInsertOne(socket, 'leaves', {
      _id: leafId,
      info: null
    })
    emit(socket, 'getActiveModule', {moduleId, branchId})

    return resolve('ok');
  })
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

/*
 * Create socket.io service
 */

const handleSocket = socket => {
  console.log('handleSocket');
  socket.on('disconnect', () => cleanUpSocket(socket));
  socket.on('token', token => handleToken(socket, token));
  socket.on('createTree', info => createTree(socket, info));
  socket.on('getTrees', (info) => getTrees(socket, info));
  socket.on('setBranchName', info => setBranchName(socket, info));
  socket.on('getBranchName', info => getBranchName(socket, info));
  socket.on('deleteTree', info => deleteTree(socket, info));
  socket.on('setActiveModule', info => setActiveModule(socket, info));
}


const io = socketio(httpsServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
io.adapter(createAdapter(eywaPubClient, eywaSubClient));
io.on('connection', (socket) => handleSocket(socket));
