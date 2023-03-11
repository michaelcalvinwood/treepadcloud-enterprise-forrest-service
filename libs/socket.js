
const subscribe = (socket, resource, token) => {
    console.log('subscribe event');
    return new Promise((resolve, reject) => {
        socket.emit('subscribe', 'success');

        resolve('ok');
    })
}

const handleSocketEvents = socket => {
    socket.on('subscribe', (resource, token) => subscribe(socket, resource, token));
}

exports.handleConnection = socket => {
    console.log(socket.id);
    socket.emit('hello', socket.id);

    handleSocketEvents(socket);
}