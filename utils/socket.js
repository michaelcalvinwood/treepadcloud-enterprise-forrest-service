
const mongo = require('./mongodb');
const tree = require('./treeCommands')

const subscribe = (socket, resource, token) => {
    console.log('subscribe event');
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
}

exports.handleConnection = socket => {
    console.log(socket.id);
    socket.emit('hello', socket.id);

    handleSocketEvents(socket);
}