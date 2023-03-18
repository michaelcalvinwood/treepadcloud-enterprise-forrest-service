const { v4: uuidv4 } = require('uuid');
const branchUtils = require('./branch-utils');
const mongo = require('mongodb');

/*
 * Get socket.io and mongodb settings
 */

let io;

exports.setIo = connection => {
    io = connection;
}

let mongoDb;

exports.setMongoDb = setting => {
    mongoDb = setting;
}

let mongoDbO;

exports.setMongoDbO = setting => {
    mongoDbO = setting;
}

/*
 * array for serializing treeCommands
 */

exports.treeCommands = [];

/*
 * Tree Commands
 */

const w = {};

const sleep = ms => new Promise(r => setTimeout(r, ms));
const extractUsername = userResource => userResource.split('--')[1];
const generateTreeId = (userName) => `T--${userName}--${uuidv4()}`;
const generateBranchId = (userName, treeId) => `B--${uuidv4()}--${treeId}}`;

const addUser = async (userName) => {
    try {
        await mongoDbO.collection('users').insertOne( {
            _id: userName,
            trees: []
        })
    } catch (e) {
        console.error(`ERROR: treeCommands createUser: ${e.message}`, e);
        return false;
    }

    return true;
}
const addBranch = async (userName, treeId) => {
    branchId = generateBranchId(userName, treeId);
    try {
        await mongoDbO.collection('branches').insertOne({
          _id: branchId,
          sIndex: 0,
          name: '',
          modules: [],
          userName,
          activeModule: null
        });
    } catch (e) {
        console.error(`Error: treeCommands createBranch: ${e.message}`, e);
        return false;
    }

    return branchId;
}

const addTree = async (info) => {
    const debug = true;
    if (debug) console.log('addTree', info);
    const { userName, treeName, treeDesc, icon } = info;
    treeId = generateTreeId(userName);
      
    const branchId = await addBranch(userName, treeId);
    
    await mongoDbO.collection('trees').insertOne({
    _id: treeId,
    sIndex: 0,
    icon,
    name: treeName,
    desc: treeDesc,
    branches: [
        {
        _id: branchId,
        level: 0
        }
    ]
    })
    
    await mongoDbO.collection('users').updateOne({_id: userName}, {$push: {trees: treeId}});
    return treeId;
}

/*
 * window functions
 */

w.getTrees = async ({socket, resource}) => {
   try {
    const user = extractUsername(resource);
    
    const res = await mongoDbO.collection('users').findOne({_id: user});
    if (!res) return;
    const treeIds = res.trees;
    const trees = [];
    for (let i = 0; i < treeIds.length; ++i) {
        const info = await mongoDbO.collection('trees').findOne({_id: treeIds[i]});
        if (info) trees.push(info);
    }
    if (trees.length) socket.emit('addTrees', {resource, trees});
   } catch(e) {
    console.error(`ERROR ${e.message} in treeCommands getTrees for resource: ${resource}`);
    return false;
   }
}


w.createTree = async (info) => {

    const debug = true;
    if (debug) console.log('createTree', info);
    
    const { resource, icon, treeName, treeDesc, userName, socket } = info;
    
    // check to see if the user already has a tree by that name
    const user = await mongoDbO.collection('users').findOne({_id: userName});
    if (debug) console.log('createTree user', user);
    if (!user) await addUser(userName);

    const treeId = await addTree(info);
    
    const tree = await mongoDbO.collection('trees').findOne({_id: treeId});
    console.log('new Tree', tree);
    socket.emit('addTrees', {resource, trees: [tree]});
    return;
}

w.deleteTree = async ({treeId, socket}) => {
    try {
        const debug = true;
        if (debug) console.log('deleteTree', treeId);
    
        const parts = treeId.split('--');
        const user = parts[1];
    
        if (debug) console.log('deleteTree user', user);

        const branches = await mongoDbO.collection('trees').findOne({_id: treeId});
    
        if (debug) console.log('deleteTree branches', branches);
    
        if (branches) {
            for (let i = 0; i < branches.length; ++i) {
                // TODO get all leaves on each branch and delete them (including all data associated with them)
                
                await mongoDbO.collection('branches').deleteOne({_id: branches[i]._id});
            }
        }
    
        await mongoDbO.collection('trees').deleteOne({_id: treeId});
        
        let { trees } = await mongoDbO.collection('users').findOne({_id: user});

        if (debug) console.log('deleteTree trees', trees);

        if (trees) {
            trees = trees.filter(tree => tree._id !== treeId);
            await mongoDbO.collection('users').updateOne({_id: user}, {$set: {trees}});
        }

        socket.emit('deleteTree', treeId);
    } catch (e) {
        console.error('ERROR: TreeCommands w.deleteTree: ', e.message, e);
    }

}

w.addBranch = async ({treeId, siblingId, socket}) => {
    try {
        const debug = true;
        if (debug) console.log('addBranch', treeId, siblingId);
        const tree = await mongoDbO.collection('trees').findOne({_id: treeId});
        if (!tree) return;
        
        let { branches } = tree;
        if (!branches) return;

        const newBranchId = await addBranch(treeId.split('--')[1], treeId);
        const newBranch = await mongoDbO.collection('branches').findOne({_id: newBranchId});

        branchUtils.insertBranch(newBranch, siblingId, branches);
        branches = branches.map(branch => ({_id: branch._id, level: branch.level}));
        
        await mongoDbO.collection('trees').updateOne({_id: treeId}, {$set: {branches}});

        socket.emit('setBranches', {treeId, branches});

        
    } catch (e) {
        console.error ('ERROR: treeCommands w.addTree : ', e.message, e);
    }
}

const doTreeCommands = async () => {

    while (1) {
        if (this.treeCommands.length) {
            let treeCommand = this.treeCommands.pop();
            const {command, data} = treeCommand;
            try {
                w[command](data);
            } catch (e) {
                console.error(`ERROR ${e.message} in treeCommands for command: ${command}`);
            }
            
            //io.in(treeCommand.data.resource).emit('msg', "hello senor");
        } else await sleep(250);
    }
}

doTreeCommands();