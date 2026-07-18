npx create-expo-app whatsapp-frontend --template blank

cd whatsapp-frontend

npm install socket.io-client react-navigation react-native-gifted-chat

(Note: react-native-gifted-chat is a pre-built chat UI library that saves you hundreds of hours of design work).

Create your main chat screen in App.js:

import React, { useState, useEffect, useCallback } from 'react';
import { GiftedChat } from 'react-native-gifted-chat';
import { io } from 'socket.io-client';

// Connect to your Node.js backend (Use your local IP address instead of localhost on physical devices)
const socket = io('http://YOUR_SERVER_IP:5000'); 

export default function App() {
  const [messages, setMessages] = useState([]);

  // Hardcoded for demo: User A is texting User B
  const userId = 'user_A';
  const receiverId = 'user_B';
  const roomId = 'room_userA_userB'; 

  useEffect(() => {
    // Join the private chat room
    socket.emit('join_room', roomId);

    // Listen for new messages from the server
    socket.on('receive_message', (data) => {
      const formattedMessage = {
        _id: Math.random().toString(), // unique id
        text: data.text,
        createdAt: new Date(),
        user: {
          _id: data.sender,
          name: data.sender === userId ? 'Me' : 'Friend',
        },
      };
      setMessages((previousMessages) => GiftedChat.append(previousMessages, formattedMessage));
    });

    return () => {
      socket.off('receive_message');
    };
  }, []);

  // When a user presses "Send"
  const onSend = useCallback((messages = []) => {
    const { text } = messages[0];

    // Send message to backend via socket
    socket.emit('send_message', {
      sender: userId,
      receiver: receiverId,
      text: text,
      roomId: roomId
    });

    setMessages((previousMessages) => GiftedChat.append(previousMessages, messages));
  }, []);

  return (
    <GiftedChat
      messages={messages}
      onSend={(messages) => onSend(messages)}
      user={{
        _id: userId,
      }}
    />
  );
}
