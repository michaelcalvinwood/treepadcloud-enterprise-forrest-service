const debug = true;
const mongo = require('./mongodb');
const tree = require('./treeCommands')

const subscribe = (socket, resource, token) => {
    return new Promise((resolve, reject) => {
        socket.treePad = {};
        socket.treePad.token = token;
        socket.treePad.resource = resource;
        socket.join(resource);
        socket.emit('subscribe', 'success');
        tree.treeCommands.push({command: 'getTrees', data: {socket, resource}});
        resolve('ok');
    })
}

const handleSocketEvents = socket => {
    socket.on('subscribe', ({resource, token}) => subscribe(socket, resource, token));
    socket.on('createTree', data => tree.treeCommands.push({command: 'createTree', data: {...data, socket}}));
    socket.on('deleteTree', treeId => tree.treeCommands.push({command: 'deleteTree', data: {treeId, socket}}));
    socket.on('addBranch', ({treeId, siblingId}) => tree.treeCommands.push({command: 'addBranch', data: {treeId, siblingId, socket}}));
    socket.on('updateBranchName', ({branchId, branchName}) => tree.treeCommands.push({command: 'updateBranchName', data: {branchId, branchName, socket}}))
      
    socket.onAny((eventName, ...args) => {
        if (!debug) return;

        console.log(`Event: ${eventName}`);
        for (let i = 0; i < args.length; ++i) console.log(`\t${JSON.stringify(args[i], null, 4)}`);
    })
}

exports.handleConnection = socket => {
    console.log(socket.id);
    socket.emit('hello', socket.id);

    handleSocketEvents(socket);
}