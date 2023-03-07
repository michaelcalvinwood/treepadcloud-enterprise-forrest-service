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
const treeCommands = [];
const branchCommands = [];
const treeIndexes = {};
const branchIndexes = {};

const isEmptyObject = obj => Object.keys(obj).length === 0;

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

    //console.log('compare', curTime, expiration);

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

const mongoFindOne = async (socket, collection, query, projections = {}) => {
  const debug = true;
  if (debug) console.log('mongoFindOne', collection, query, projections);
  return new Promise(async (resolve, reject) => {
    if (isEmptyObject(projections)) {
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
    } else {
      await mongoDbO.collection(collection).findOne(query, {projection: projections})
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
    }
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

const getSIndex = async (socket, collection, _id) => {
  const debug = true;
  if (debug) console.log('getSIndex', collection, _id);

  const result = await mongoFindOne(socket, collection, {_id: _id}, {sIndex: 1});
  if (debug) console.log('getSIndex result', result);

  return result !== null ? result.sIndex : false;
}

const generateBranchId = userName => `B-${userName}-${uuidv4()}`;

const createUser = (socket, userName) => {
  return new Promise (async (resolve, reject) => {
    await mongoInsertOne(socket, 'users', {
      _id: userName,
      trees: []
    })
    resolve('ok');
  })
}

const createBranch = async (socket, userName) => {
  branchId = generateBranchId(userName);
  await mongoInsertOne(socket, 'branches', {
    _id: branchId,
    sIndex: 0,
    name: '',
    modules: [],
    activeModule: null
  })

  return branchId;
}

const addTree = (socket, info) => {
  const debug = true;
  if (debug) console.log('addTree', info);
  const { userName, treeName, treeDesc, icon } = info;

  return new Promise(async (resolve, reject) => {
    const branchId = await createBranch(socket, userName);
   
    treeId = `T-${userName}-${uuidv4()}`;
    treeIndexes[treeId] = 0;
    await mongoInsertOne(socket, 'trees', {
      _id: treeId,
      sIndex: 0,
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

    //sendMessage(socket, `Tree ${info.treeName} created.`);
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
      if (debug) console.log('getTrees treeInfo', treeInfo);
      trees.push(treeInfo[0]);
    }
    
    if (debug) console.log('getTrees trees', trees);
    emit(socket, 'getTrees', trees);
    resolve('ok');
  })
}

const setBranchName = (socket, info) => {
  const debug = true;
  if (debug) console.log('setBranchName', info);

  return new Promise(async (resolve, reject) => {
    await mongoUpdateOne(socket, 'branches', {_id: info.id}, {$set: {name: info.name}})
    emit(socket, 'setBranchName', 'setBranchName', {branchId: info.id, branchName: info.name});
  })
}

const getBranchName = (socket, info) => {
  const debug = false;
  if (debug) console.log('getBranchName', info);
  return new Promise(async (resolve, reject) => {
    let res = await mongoFindOne(socket, 'branches', {_id: info.id});
    if (res) {
      emit(socket, 'setBranchName', {branchId: info.id, branchName: res.name});
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
  if (debug) console.log('setActiveModule', info);
  const { userName, moduleId, branchId } = info;
  const leafId = 'L' + branchId + '-' + moduleId;

  return new Promise(async (resolve, reject) => {
    await mongoUpdateOne(socket, 'branches', {_id: branchId}, {$addToSet: { modules: moduleId}, $set: {activeModule: moduleId}});

    const leaf = await mongoFindOne(socket, 'leaves', {_id: leafId});
    if (!leaf) await mongoInsertOne(socket, 'leaves', {
      _id: leafId,
      signed: jwt.sign({leafId, moduleId}, process.env.JWT_SECRET_KEY),
      module: moduleId,
      info: null
    })
    emit(socket, 'ActiveModule', {moduleId, branchId})

    return resolve('ok');
  })
}

const getActiveModule = (socket, info) => {
  const debug = true;
  if (debug) console.log('getActiveModule', info);
  const { userName, branchId } = info;

  return new Promise(async (resolve, reject) => {
    const branch = await mongoFindOne(socket, 'branches', {_id: branchId});
    if (debug) console.log('getActiveModule branch', branch);
    emit(socket, 'ActiveModule', {moduleId: branch.activeModule, branchId})
    resolve('ok');
  })

  
}

const getLeaf = (socket, info) => {
  const debug = true;
  if (debug) console.log('getLeaf', info);

  const {userName, leafId} = info;
  return new Promise(async (resolve, reject) => {
    const leaf = await mongoFindOne(socket, 'leaves', {_id: leafId});
    if (leaf) emit(socket, 'getLeaf', leaf);
    return resolve('ok');
  })

}

const updateTree = (socket, info) => {
  const debug = true;
  if (debug) console.log('updateTree', info);
  const { treeId, icon, treeName, treeDesc, userName } = info;

  return new Promise(async (resolve, reject) => {
    await mongoUpdateOne(socket, 'trees', {_id : treeId}, {$set: {icon, name: treeName, desc: treeDesc}});
    getTrees(socket, info);
    resolve('ok');
  })

}

const prevSiblingIndex = (branches, index) => {
  if (index <= 0) return false;
  if (index >= branches.length) return false;

  const level = branches[index].level;
  for (let i = index - 1; i >= 0; --i) {
    if (branches[i].level === level) return i;
  }

  return false;
}

/*
 * Serialized Commands
 */

window.addBranch = async info => {
  const debug = false;
  const { treeId, branchId, userName, socket } = info;
  
  if (debug) console.log('addBranch', treeId, branchId, userName);
  
  const newBranchId = await createBranch(socket, userName);
  const tree = await mongoFindOne(socket, 'trees', {_id: treeId});
  if (tree === null) return sendMessage(socket, `Could not find tree ${treeId} in addBranch`);
  if (debug) console.log('addBranch tree', tree);
  let { sIndex, branches } = tree;
  const index = branches.findIndex(branch => branch.branchId === branchId);
  console.log('addTree index', index);
  if (index === -1) return sendMessage(socket, `Could not find branch ${branchId} in tree ${treeId} in addBranch`);  
  const level = branches[index].level;
  if (debug) console.log('addBranch sIndex branch', sIndex, branches[index]);
  const newBranch = {branchId: newBranchId, level}
  branches.splice(index+1, 0, newBranch);
  console.log('addBranch branches after splice', branches);
  ++sIndex;
  await mongoUpdateOne(socket, 'trees', { _id: treeId}, {$set: {branches, sIndex}})
  emit(socket, 'addBranch', {treeId, branchId, newBranch});
}

window.deleteBranch = async info => {
  const debug = true;
  const { treeId, branchId, userName, socket } = info;

  // IMPORTANT TODO: GET ALL BRANCHES AND FIND ALL CHILDREN AND DELETE ALL CHILDREN WHEN HIERARCHY EXISTS

  // IMPORTANT TODO: REMOVE ALL DATA FROM MODULES AND REMOVE MODULES FROM BRANCH AND CHILDREN 

  await mongoDeleteOne(socket, 'branches', {_id: branchId});
  await mongoUpdateOne(socket, 'trees', {_id: treeId}, {$pull: {branches: {branchId}}})
  emit (socket, 'deleteBranch', {treeId, branchId});
}

window.moveBranchUp = async info => {
  const debug = true;
  const { treeId, branchId, userName, socket } = info;

  // IMPORTANT TODO: GET ALL BRANCHES AND FIND ALL CHILDREN AND DELETE ALL CHILDREN WHEN HIERARCHY EXISTS

  // IMPORTANT TODO: REMOVE ALL DATA FROM MODULES AND REMOVE MODULES FROM BRANCH AND CHILDREN 
  const tree = await mongoFindOne(socket, 'trees', {_id: treeId});
  if (tree === null) return sendMessage(socket, `Could not find tree ${treeId} in addBranch`);
  if (debug) console.log('moveBranchUp tree', tree);
  let { sIndex, branches } = tree;
  ++sIndex;
  const index = branches.findIndex(branch => branch.branchId === branchId);
  if (index === -1) return sendMessage(socket, `Could not find branch ${branchId} in tree ${treeId}`);
  if (index === 0) return sendMessage(socket, 'Cannot move the topmost branch up');

  const branch = branches.splice(index, 1)[0];
  branches.splice(index-1, 0, branch);
  await mongoUpdateOne(socket, 'trees', {_id: treeId}, {$set: {branches, sIndex}})
  emit (socket, 'moveBranchUp', {treeId, branchId, sIndex});
}

window.moveBranchDown = async info => {
  const debug = true;
  const { treeId, branchId, userName, socket } = info;

  // IMPORTANT TODO: GET ALL BRANCHES AND FIND ALL CHILDREN AND DELETE ALL CHILDREN WHEN HIERARCHY EXISTS

  // IMPORTANT TODO: REMOVE ALL DATA FROM MODULES AND REMOVE MODULES FROM BRANCH AND CHILDREN 
  const tree = await mongoFindOne(socket, 'trees', {_id: treeId});
  if (tree === null) return sendMessage(socket, `Could not find tree ${treeId} in addBranch`);
  if (debug) console.log('moveBranchDown tree', tree);
  let { sIndex, branches } = tree;
  ++sIndex;
  const index = branches.findIndex(branch => branch.branchId === branchId);
  if (index === -1) return sendMessage(socket, `Could not find branch ${branchId} in tree ${treeId}`);
  if (index >= branches.length) return sendMessage(socket, 'Cannot move the bottom-most branch down');

  const branch = branches.splice(index, 1)[0];
  branches.splice(index+1, 0, branch);
  await mongoUpdateOne(socket, 'trees', {_id: treeId}, {$set: {branches, sIndex}})
  emit (socket, 'moveBranchDown', {treeId, branchId, sIndex});
}

window.moveBranchRight = async info => {
  const debug = true;
  const { treeId, branchId, userName, socket } = info;

  const tree = await mongoFindOne(socket, 'trees', {_id: treeId});
  if (tree === null) return sendMessage(socket, `Could not find tree ${treeId} in moveBranchRight`);
  if (debug) console.log('moveBranchRight tree', tree);
  let { sIndex, branches } = tree;
  ++sIndex;
  const index = branches.findIndex(branch => branch.branchId === branchId);
  if (index === -1) return sendMessage(socket, `Could not find branch ${branchId} in tree ${treeId}`);
  if (index === 0) return sendMessage(socket, `Cannot indent highest branch`);
  if (branches[index].level > branches[index-1].level) return sendMessage(`Branch is already indented`);
  if (branches[index].level >= 5) return sendMessage(socket, 'Cannot indent branches beyond five levels');

  ++branches[index].level;
  await mongoUpdateOne(socket, 'trees', {_id: treeId}, {$set: {branches, sIndex}})
  emit (socket, 'moveBranchRight', {treeId, branchId, sIndex});
}

window.moveBranchLeft = async info => {
  const debug = true;
  const { treeId, branchId, userName, socket } = info;

  const tree = await mongoFindOne(socket, 'trees', {_id: treeId});
  if (tree === null) return sendMessage(socket, `Could not find tree ${treeId} in moveBranchRight`);
  if (debug) console.log('moveBranchLeft tree', tree);
  let { sIndex, branches } = tree;
  ++sIndex;
  const index = branches.findIndex(branch => branch.branchId === branchId);
  if (index === -1) return sendMessage(socket, `Could not find branch ${branchId} in tree ${treeId}`);
  if (index === 0) return sendMessage(socket, `Cannot outdent highest branch`);
  if (branches[index].level === branches[index-1].level) return sendMessage(`Branch is already outdented`);
  
  --branches[index].level;
  const prevSibling = prevSiblingIndex(branches, index);
  if (!prevSibling === index - 1) {
    let removed = branches.splice(index, 1)[0];
    branches.splice(prevSibling + 1, 0, removed)
  }

  await mongoUpdateOne(socket, 'trees', {_id: treeId}, {$set: {branches, sIndex}})
  emit (socket, 'moveBranchLeft', {treeId, branchId, sIndex});
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
 * Command Serialization
 */


async function sleep(milliseconds) {
  return new Promise((resolve) =>setTimeout(resolve, milliseconds));
}

async function handleTreeCommands () {
  while(1) {
    while (treeCommands.length) {
      const command = treeCommands.pop();
      console.log('treeCommand', command);
      const { name, info } = command;
      console.log('name',name);
      
      await window[name](info);
    }
    await sleep(250);
  }
}
handleTreeCommands();

async function handleBranchCommands () {
  while(1) {
    while (branchCommands.length) {
      const command = branchCommands.pop();
      const { name, info } = command;
      await window[name](info);
    }
    await sleep(250);
  }
}

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
  socket.on('getActiveModule', info => getActiveModule(socket, info));
  socket.on('getLeaf', info => getLeaf(socket, info));
  socket.on('updateTree', info => updateTree(socket, info));

  socket.on('addBranch',  info => { console.log('got addBranch'); treeCommands.push({
    name: 'addBranch',
    info: {...info, socket}
  })})
  
  socket.on('deleteBranch',  info => {treeCommands.push({
    name: 'deleteBranch',
    info: {...info, socket}
  })})

  socket.on('moveBranchUp',  info => {
    treeCommands.push({
      name: 'moveBranchUp',
      info: {...info, socket}
    })
  })

  socket.on('moveBranchDown',  info => {
    treeCommands.push({
      name: 'moveBranchDown',
      info: {...info, socket}
    })
  })

  socket.on('moveBranchRight',  info => {
    treeCommands.push({
      name: 'moveBranchRight',
      info: {...info, socket}
    })
  })

  socket.on('moveBranchLeft',  info => {
    treeCommands.push({
      name: 'moveBranchLeft',
      info: {...info, socket}
    })
  })
}


const io = socketio(httpsServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
io.adapter(createAdapter(eywaPubClient, eywaSubClient));
io.on('connection', (socket) => handleSocket(socket));

