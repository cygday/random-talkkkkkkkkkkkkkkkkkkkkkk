const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Explicit CORS setup for your Vercel URL
app.use(cors({
    origin: ["https://vercel.app", "http://localhost:19006"],
    methods: ["GET", "POST"]
}));

const server = http.createServer(app);
const io = new Server(server, {
    cors: { 
        origin: ["https://vercel.app", "http://localhost:19006"],
        methods: ["GET", "POST"]
    }
});

// Production Root URL health check endpoint
app.get('/', (req, res) => {
    res.send('Random Talk Backend Server Status: Running & Connected Successfully');
});

const dbURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/random-talk';

mongoose.connect(dbURI)
  .then(() => console.log('Connected to MongoDB Atlas successfully!'))
  .catch(err => console.error('Database connection error:', err));

const MessageSchema = new mongoose.Schema({
    sender: String,
    receiver: String,
    text: String,
    roomId: String,
    timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', MessageSchema);

// Matchmaking State
let waitingQueue = []; 
let activeMatches = {}; 

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('find_random_partner', (username) => {
        console.log(`${username} (${socket.id}) is searching for a match...`);
        waitingQueue = waitingQueue.filter(user => user.socketId !== socket.id);

        if (waitingQueue.length > 0) {
            const partner = waitingQueue.shift(); 
            const roomId = `room_${socket.id}_${partner.socketId}`;

            socket.join(roomId);
            const partnerSocket = io.sockets.sockets.get(partner.socketId);
            if (partnerSocket) {
                partnerSocket.join(roomId);
            }

            activeMatches[socket.id] = { partnerId: partner.socketId, roomId, partnerUsername: partner.username };
            activeMatches[partner.socketId] = { partnerId: socket.id, roomId, partnerUsername: username };

            io.to(socket.id).emit('match_found', { partner: partner.username, roomId });
            io.to(partner.socketId).emit('match_found', { partner: username, roomId });

            console.log(`Matched: ${username} <-> ${partner.username}`);
        } else {
            waitingQueue.push({ socketId: socket.id, username });
            socket.emit('waiting', 'Searching for a partner...');
            console.log(`${username} added to waiting queue.`);
        }
    });

    socket.on('send_message', async (data) => {
        try {
            const { sender, receiver, text, roomId } = data;
            const newMessage = new Message({ sender, receiver, text, roomId });
            await newMessage.save();
            socket.to(roomId).emit('receive_message', data);
        } catch (err) {
            console.error('Error saving or broadcasting message:', err);
        }
    });

    socket.on('leave_chat', () => {
        handleDisconnect(socket);
    });

    socket.on('disconnect', () => {
        handleDisconnect(socket);
    });

    socket.on("offer", (data) => {
        socket.to(data.roomId).emit("offer", data);
  });

  socket.on("answer", (data) => {
    socket.to(data.roomId).emit("answer", data);
  });

  socket.on("ice-candidate", (data) => {
    socket.to(data.roomId).emit("ice-candidate", data);
  });


  socket.on("send_image", (data) => {

     io.to(data.roomId)
        .emit("receive_image", data);

});

});


function handleDisconnect(socket) {
    waitingQueue = waitingQueue.filter(user => user.socketId !== socket.id);
    const match = activeMatches[socket.id];
    if (match) {
        console.log(`User left chat. Notifying partner: ${match.partnerUsername}`);
        io.to(match.roomId).emit('partner_disconnected', 'Your partner has disconnected.');

        const partnerSocket = io.sockets.sockets.get(match.partnerId);
        if (partnerSocket) {
            partnerSocket.leave(match.roomId);
        }

        delete activeMatches[match.partnerId];
        delete activeMatches[socket.id];
    }
}

const PORT = process.env.PORT || 8082;
// CHANGED: Using server.listen instead of app.listen so WebSockets hook into the HTTP stream
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
