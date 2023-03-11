
/*
 * MongoDB requirements
 */
const mongo = require('mongodb');

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
  