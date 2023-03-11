
const mongo = require('./mongodb');
const tree = require('./treeCommands')

const subscribe = (socket, resource, token) => {
    console.log('subscribe event');
    return new Promise((resolve, reject) => {
        socket.emit('subscribe', 'success');
        tree.treeCommands.push({command: 'getTrees', data: {resource, token}});
        socket.join(resource);
        resolve('ok');
    })
}

const handleSocketEvents = socket => {
    socket.on('subscribe', ({resource, token}) => subscribe(socket, resource, token));
}

exports.handleConnection = socket => {
    console.log(socket.id);
    socket.emit('hello', socket.id);

    handleSocketEvents(socket);
}