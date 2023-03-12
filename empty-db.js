const mongo = require('mongodb')
const mongoUrl = 'mongodb://127.0.0.1:27017/';
const mongoClient = mongo.MongoClient;
let mongoDb = null;
let mongoDbO = null;

mongoClient.connect('mongodb://127.0.0.1:27017/treepadcloud_forrest',{
    useNewUrlParser: true, 
    useUnifiedTopology: true
})
.then(db => {
  console.log('Mongo DB is connected')
  mongoDb = db;
  mongoDbO = mongoDb.db('treepadcloud_forrest');
})
.then(res => mongoDbO.collection('users').deleteMany({}))
.then(res => mongoDbO.collection('trees').deleteMany({}))
.then(res => mongoDbO.collection('branches').deleteMany({}))
.then(res => mongoDbO.collection('leaves').deleteMany({}))
.catch(err => console.log(err));