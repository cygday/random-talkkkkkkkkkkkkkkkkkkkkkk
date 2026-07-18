const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

mongoose.connect('mongodb://127.0.0.1:27017/whatsappClone');

const MessageSchema = new mongoose.Schema({
    sender: String,
    receiver: String,
    text: String,
    roomId: String,
    timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', MessageSchema);

// Matchmaking State
let waitingQueue = []; // Users waiting for a match: [{ socketId, username }]
let activeMatches = {}; // Track active pairings: { socketId: { partnerId, roomId, partnerUsername } }

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // When a user requests to find a random partner
    socket.on('find_random_partner', (username) => {
        console.log(`${username} (${socket.id}) is searching for a match...`);

        // Remove user from waiting queue if they are already in it (prevent double-queueing)
        waitingQueue = waitingQueue.filter(user => user.socketId !== socket.id);

        if (waitingQueue.length > 0) {
            // Pair them with the first person in the queue
            const partner = waitingQueue.shift(); 
            const roomId = `room_${socket.id}_${partner.socketId}`;

            // Join both sockets to the new room
            socket.join(roomId);
            const partnerSocket = io.sockets.sockets.get(partner.socketId);
            if (partnerSocket) {
                partnerSocket.join(roomId);
            }

            // Save match details
            activeMatches[socket.id] = { partnerId: partner.socketId, roomId, partnerUsername: partner.username };
            activeMatches[partner.socketId] = { partnerId: socket.id, roomId, partnerUsername: username };

            // Notify both users they are matched!
            io.to(socket.id).emit('match_found', { partner: partner.username, roomId });
            io.to(partner.socketId).emit('match_found', { partner: username, roomId });

            console.log(`Matched: ${username} <-> ${partner.username}`);
        } else {
            // No one is waiting, add this user to the queue
            waitingQueue.push({ socketId: socket.id, username });
            socket.emit('waiting', 'Searching for a partner...');
            console.log(`${username} added to waiting queue.`);
        }
    });

    // Handle instant messaging
    socket.on('send_message', async (data) => {
        const { sender, receiver, text, roomId } = data;
        const newMessage = new Message({ sender, receiver, text, roomId });
        await newMessage.save();

        // Send to everyone in the room except the sender
        socket.to(roomId).emit('receive_message', data);
    });

    // Handle manual disconnect/leave room
    socket.on('leave_chat', () => {
        handleDisconnect(socket);
    });

    socket.on('disconnect', () => {
        handleDisconnect(socket);
    });
});

function handleDisconnect(socket) {
    // 1. Remove from waiting queue if they were waiting
    waitingQueue = waitingQueue.filter(user => user.socketId !== socket.id);

    // 2. If they were in an active match, notify their partner
    const match = activeMatches[socket.id];
    if (match) {
        console.log(`User left chat. Notifying partner: ${match.partnerUsername}`);
        io.to(match.roomId).emit('partner_disconnected', 'Your partner has disconnected.');

        // Remove partner from the socket room
        const partnerSocket = io.sockets.sockets.get(match.partnerId);
        if (partnerSocket) {
            partnerSocket.leave(match.roomId);
        }

        // Delete active match records
        delete activeMatches[match.partnerId];
        delete activeMatches[socket.id];
    }
}

const PORT = process.env.PORT || 8082;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
