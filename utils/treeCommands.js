const mongo = require('mongodb');

let io;

exports.setIo = connection => {
    io = connection;
}

exports.treeCommands = [];

const command = {};

const sleep = ms => new Promise(r => setTimeout(r, ms));

command.getTrees = data => {
   
}

const doTreeCommands = async () => {

    while (1) {
        if (this.treeCommands.length) {
            let treeCommand = this.treeCommands.pop();
            console.log("Tree Command: ", treeCommand.data.resource);

            io.in(treeCommand.data.resource).emit('msg', "hello senor");
        } else await sleep(250);
    }
}

doTreeCommands();