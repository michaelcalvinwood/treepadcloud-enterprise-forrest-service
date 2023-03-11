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
const extractUsername = userResource => userResource.split('_')[1];

w.getTrees = async ({socket, resource, token}) => {
   try {
    const user = extractUsername(resource);
    
    const res = await mongoDbO.collection('users').findOne({_id: user});
    if (!res) return console.error('Error treeCommands getTrees: Unable to get user info for ', user);

    const { trees } = res;

    // send to individual user
    if (trees.length) socket.emit('addTrees', {resource, trees});
   } catch(e) {
    console.error(`ERROR ${e.message} in treeCommands getTrees for resource: ${resource}`);
    return false;
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