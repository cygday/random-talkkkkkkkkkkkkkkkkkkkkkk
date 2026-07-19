import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, SafeAreaView, Platform, ActivityIndicator } from 'react-native';
import { GiftedChat, Bubble } from 'react-native-gifted-chat';
import { io } from 'socket.io-client';
import * as ImagePicker from "expo-image-picker";
import { Audio } from "expo-av";




const SOCKET_URL = 'https://random-talkkkkkkkkkkkkkkkkkkkkkk.onrender.com';


export default function App() {
  const [username, setUsername] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Chat States: 'login' | 'searching' | 'chatting'
  const [chatState, setChatState] = useState('login'); 
  const [partner, setPartner] = useState('');
  const [roomId, setRoomId] = useState('');
  const [messages, setMessages] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const socketRef = useRef(null);

  const localVideoRef = useRef(null);
const remoteVideoRef = useRef(null);
const peerConnectionRef = useRef(null);

const [inCall, setInCall] = useState(false);
const [text, setText] = useState("");




	const startVideoCall = async () => {
  try {
    setInCall(true);



    const stream =
  await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });


setLocalStream(stream);

if (localVideoRef.current) {
  localVideoRef.current.srcObject = stream;
}


    localVideoRef.current.srcObject = localStream;

    const pc = new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:stun.l.google.com:19302",
        },
      ],
    });

    peerConnectionRef.current = pc;

stream.getTracks().forEach((track) => {
  pc.addTrack(track, stream);
});
    pc.ontrack = (event) => {
      remoteVideoRef.current.srcObject = event.streams[0];
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit("ice-candidate", {
          roomId,
          candidate: event.candidate,
        });
      }
    };

    const offer = await pc.createOffer();

    await pc.setLocalDescription(offer);

    socketRef.current.emit("offer", {
      roomId,
      offer,
    });

    setInCall(true);

  } catch (err) {
    console.error(err);
    alert("Camera permission denied");
  }
};





  const pickImage = async () => {
	const result =
  await ImagePicker.launchImageLibraryAsync({
    base64: true,
    quality: 0.7,
  });

if (!result.canceled) {
  socketRef.current.emit("send_image", {
    roomId,
    sender: username,
    image:
      `data:image/jpeg;base64,${result.assets[0].base64}`,
  });
}


      });
const startRecording = async () => {
  try {
    await Audio.requestPermissionsAsync();

    const recording =
      new Audio.Recording();

    await recording.prepareToRecordAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );

    await recording.startAsync();

    console.log("Recording...");
  } catch (err) {
    console.log(err);
  }
};

    }
  };


  // Initialize Socket once when user logs in
  useEffect(() => {
    if (
    inCall &&
    localVideoRef.current &&
    localStream
  ) {
    localVideoRef.current.srcObject =
      localStream;
  }
}, [inCall, localStream]);
  
  useEffect(() => {
  if (!isLoggedIn) return;


    socketRef.current = io(SOCKET_URL, {
	    transports: ['websocket', 'polling']
    });


    socketRef.current.on('connect', () => {
      console.log('Connected to server');
      findNewPartner();
    });
    
    socketRef.current.on("offer", async (data) => {
  try {
    const localStream =
      await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:stun.l.google.com:19302",
        },
      ],
    });

    peerConnectionRef.current = pc;

    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject =
          event.streams[0];
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit(
          "ice-candidate",
          {
            roomId: data.roomId,
            candidate: event.candidate,
          }
        );
      }
    };

    await pc.setRemoteDescription(
      new RTCSessionDescription(
        data.offer
      )
    );

    const answer =
      await pc.createAnswer();

    await pc.setLocalDescription(
      answer
    );

    socketRef.current.emit("answer", {
      roomId: data.roomId,
      answer,
    });

    setInCall(true);

  } catch (err) {
    console.error(err);
  }
});

 


socketRef.current.on("answer", async (data) => {
  try {
    if (peerConnectionRef.current) {
      await peerConnectionRef.current
        .setRemoteDescription(
          new RTCSessionDescription(
            data.answer
          )
        );
    }
  } catch (err) {
    console.error(err);
  }
});


socketRef.current.on(
  "ice-candidate",
  async (data) => {
    try {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current
          .addIceCandidate(
            new RTCIceCandidate(
              data.candidate
            )
          );
      }
    } catch (err) {
      console.error(err);
    }
  }
);

    // Match found event
    socketRef.current.on('match_found', (data) => {
      console.log('Matched with:', data.partner);
      setPartner(data.partner);
      setRoomId(data.roomId);
      setMessages([]); // Clear chat history for the new match
      setChatState('chatting');
    });

    // Waiting event
    socketRef.current.on('waiting', (msg) => {
      setChatState('searching');
    });

    // Listen for incoming messages
    socketRef.current.on('receive_message', (data) => {
      const formattedMessage = {
        _id: Math.random().toString(),
        text: data.text,
        createdAt: new Date(),
        user: {
          _id: data.sender,
          name: data.sender,
        },
      };
      setMessages((previousMessages) => GiftedChat.append(previousMessages, formattedMessage));
    });

	  socketRef.current.on("receive_image", (data) => {
  const imageMessage = {
    _id: Math.random().toString(),
    createdAt: new Date(),
    image: data.image,
    user: {
      _id: data.sender,
      name: data.sender,
    },
  };

  setMessages(previous =>
    GiftedChat.append(previous, imageMessage)
  );
});



    // Partner left event
    socketRef.current.on('partner_disconnected', () => {
      alert('Your partner has disconnected!');
      setChatState('searching');
      setPartner('');
      setRoomId('');
      findNewPartner();
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [isLoggedIn]);

  // Request server for a random partner
  const findNewPartner = () => {
    setChatState('searching');
    setPartner('');
    setRoomId('');
    setMessages([]);
    if (socketRef.current) {
      socketRef.current.emit('find_random_partner', username);
    }
  };

  const handleLogin = () => {
    if (username.trim() === '') {
      alert('Please enter a username!');
      return;
    }
    setIsLoggedIn(true);
  };

  const handleNext = () => {
    if (socketRef.current) {
      socketRef.current.emit('leave_chat');
    }
    findNewPartner();
  };

  const onSend = useCallback((newMessages = []) => {
    const { text } = newMessages[0];

    if (socketRef.current) {
      socketRef.current.emit('send_message', {
        sender: username,
        receiver: partner,
        text: text,
        roomId: roomId
      });
    }

    setMessages((previousMessages) => GiftedChat.append(previousMessages, newMessages));
  }, [username, partner, roomId]);

  const renderBubble = (props) => {
    return (
      <Bubble
        {...props}
        wrapperStyle={{
          right: { backgroundColor: '#dcf8c6' },
          left: { backgroundColor: '#ffffff' },
        }}
        textStyle={{
          right: { color: '#000' },
          left: { color: '#000' },
        }}
      />
    );
  };

  // --- VIEW 1: Login ---
  if (chatState === 'login') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.logo}>Random talkkkkkkkkkkkkkkkkkk</Text>
          <Text style={styles.subtitle}>Connect and chat with strangers instantly!</Text>
          <TextInput
            style={styles.input}
            placeholder="Your Username"
            placeholderTextColor="#888"
            value={username}
            onChangeText={setUsername}
          />
          <TouchableOpacity style={styles.button} onPress={handleLogin}>
            <Text style={styles.buttonText}>Find Partner</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // --- VIEW 2: Searching Screen ---
  if (chatState === 'searching') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <ActivityIndicator size="large" color="#075e54" style={{ marginBottom: 20 }} />
          <Text style={styles.waitingTitle}>Searching for a Partner...</Text>
          <Text style={styles.subtitle}>Please wait, matching you with a stranger.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // --- VIEW 3: Chat Screen ---

  return (
   <SafeAreaView style={styles.chatContainer}>
     <View style={styles.header}>
       <View>
         <Text style={styles.headerText}>
           Stranger ({partner})
         </Text>
         <Text style={styles.headerSubtitle}>
           Logged in as: {username}
         </Text>
       </View>

       <View style={{ flexDirection: 'row', alignItems: 'center' }}>

         <TouchableOpacity
           style={styles.nextButton}
           onPress={pickImage}
         >
          <Text style={styles.nextButtonText}>📷 IMAGE</Text>
         </TouchableOpacity>

         <TouchableOpacity
           style={[
             styles.nextButton,
             { marginLeft: 8 }
           ]}
           onPress={startVideoCall}
          >
          <Text style={styles.nextButtonText}>📹 VC</Text>
          </TouchableOpacity>

          <TouchableOpacity
           style={[
             styles.nextButton,
             { marginLeft: 8 }
            ]}
             onPress={handleNext}
            >
           <Text style={styles.nextButtonText}>
             Next ➡️
           </Text>
           </TouchableOpacity>
	  <TouchableOpacity
  onPress={() => setText(text + "😀")}
>
  <Text>😀</Text>
</TouchableOpacity>

<TouchableOpacity
  onPress={() => setText(text + "❤️")}
>
  <Text>❤️</Text>
</TouchableOpacity>

<TouchableOpacity
  onPress={() => setText(text + "🔥")}
>
  <Text>🔥</Text>
</TouchableOpacity>

      </View>
    </View>
     <View style={styles.giftedChatWrapper}>

  {inCall && (
    <View style={{ flexDirection: "row",
      justifyContent: "space-between",
      padding: 10,
      gap: 10, }}>

      <video
        ref={localVideoRef}
        autoPlay
        muted
        playsInline
        style={{
          width: 250,
          height: 180,
          backgroundColor: '#000',
          borderRadius: 10,
        }}
      />

      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        style={{
          width: 250,
          height: 180,
          backgroundColor: '#000'
        }}
      />

    </View>
  )}

  <GiftedChat
    messages={messages}
    onSend={(newMessages) => onSend(newMessages)}
    user={{
      _id: username,
      name: username,
    }}
    renderBubble={renderBubble}
    placeholder="Type a message..."
    alwaysShowSend
  />

	  <TextInput
  value={text}
  onChangeText={setText}
  onSubmitEditing={() => {
    if (text.trim()) {
      onSend([
        {
          _id: Date.now(),
          text,
          createdAt: new Date(),
          user: {
            _id: username,
          },
        },
      ]);

      setText("");
    }
  }}
/>



</View>

  </SafeAreaView>

 );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#075e54',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: Platform.OS === 'web' ? 400 : '90%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 30,
    alignItems: 'center',
    textAlign: 'center',
  },
  logo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#075e54',
    marginBottom: 5,
  },
  waitingTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  subtitle: {
    color: '#666',
    marginBottom: 25,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    marginBottom: 15,
  },
  button: {
    width: '100%',
    height: 50,
    backgroundColor: '#25d366',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Chat layout
  chatContainer: {
    flex: 1,
    backgroundColor: '#ece5dd',
  },
  header: {
    height: 70,
    backgroundColor: '#075e54',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 24 : 0,
  },
  headerText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#b3d4d0',
    fontSize: 12,
  },
  nextButton: {
    backgroundColor: '#25d366',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  nextButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  giftedChatWrapper: {
    flex: 1,
  },
});
