const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid'); // Need to install uuid

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from the client build
app.use(express.static(path.join(__dirname, 'client_build')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// --- PERSISTENCE ---
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Ensure data dir exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial DB State
const INITIAL_DB = {
  chats: [
    {
      id: "default-chat",
      name: "Sarah",
      avatarColor: "linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%)",
      messages: [
        { id: 1, text: "You matched with Sarah! 💖", system: true },
        { id: 2, text: "20:30", system: true, time: true },
      ],
      presets: [
        "Hey! 👋",
        "How are you?",
        "Wanna meet up?",
        "Tell me more about yourself."
      ]
    }
  ],
  activeChatId: "default-chat"
};

// Load DB
let db = { ...INITIAL_DB };
if (fs.existsSync(DB_FILE)) {
  try {
    const fileData = fs.readFileSync(DB_FILE, 'utf8');
    db = JSON.parse(fileData);
    // Merge structure updates if any (simple check)
    if (!db.chats) db.chats = INITIAL_DB.chats;
    if (!db.activeChatId) db.activeChatId = INITIAL_DB.activeChatId;
  } catch (e) {
    console.error("Failed to load DB, using initial state:", e);
  }
} else {
  // Write initial state
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// Save DB Helper
const saveDb = () => {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  } catch (e) {
    console.error("Failed to save DB:", e);
  }
};

// --- API / SOCKET LOGIC ---

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Send initial state to client
  socket.emit('init', db);

  // --- CONTROL EVENTS ---

  // Create new chat
  socket.on('control:create_chat', (name) => {
    const newChat = {
      id: uuidv4(),
      name: name || "New Match",
      avatarColor: `linear-gradient(135deg, #${Math.floor(Math.random() * 16777215).toString(16)} 0%, #${Math.floor(Math.random() * 16777215).toString(16)} 100%)`, // Random gradient
      messages: [
        { id: Date.now(), text: `You matched with ${name || "New Match"}! 💖`, system: true }
      ],
      presets: ["Hey! 👋"]
    };
    db.chats.push(newChat);
    saveDb();
    io.emit('data:update', db); // Broadcast full update to all
  });

  // Select Chat (Active Chat)
  socket.on('control:select_chat', (chatId) => {
    db.activeChatId = chatId;
    saveDb();
    io.emit('actor:switch_chat', chatId);
    io.emit('data:update', db);
  });

  // Rename Chat
  socket.on('control:update_chat', ({ chatId, name }) => {
    const chat = db.chats.find(c => c.id === chatId);
    if (chat) {
      chat.name = name;
      // Update match system message if it's the first one? Optional.
      saveDb();
      io.emit('data:update', db);
    }
  });

  // Add Preset
  socket.on('control:save_preset', ({ chatId, text }) => {
    const chat = db.chats.find(c => c.id === chatId);
    if (chat) {
      if (!chat.presets) chat.presets = [];
      chat.presets.push(text);
      saveDb();
      io.emit('data:update', db);
    }
  });

  // Control sending a message (Match sending)
  socket.on('control:send_message', ({ chatId, text }) => {
    const chat = db.chats.find(c => c.id === chatId);
    if (chat) {
      const msg = { id: Date.now(), text, sender: 'match' };
      chat.messages.push(msg);
      saveDb();

      io.emit('data:update', db);
      // Also direct event for immediate animation if needed, though data:update covers it
      io.emit('actor:receive_message', { chatId, msg });
    }
  });

  // Control Clear Chat
  socket.on('control:clear', (chatId) => {
    const chat = db.chats.find(c => c.id === chatId);
    if (chat) {
      chat.messages = [
        { id: Date.now(), text: `You matched with ${chat.name}! 💖`, system: true }
      ];
      saveDb();
      io.emit('data:update', db);
      io.emit('actor:clear', chatId);
    }
  });

  // Control Reset Scene (Specific Chat)
  socket.on('control:reset', (chatId) => {
    const chat = db.chats.find(c => c.id === chatId);
    if (chat) {
      chat.messages = [
        { id: 1, text: `You matched with ${chat.name}! 💖`, system: true },
        { id: 2, text: "20:30", system: true, time: true },
      ];
      saveDb();
      io.emit('data:update', db);
      io.emit('actor:reset', chatId);
    }
  });

  // Control Typing
  socket.on('control:typing_start', (chatId) => {
    io.emit('actor:typing_start', chatId);
  });


  // --- ACTOR EVENTS ---

  // Actor sending a message (USER typing)
  socket.on('actor:send_message', ({ chatId, text }) => {
    const chat = db.chats.find(c => c.id === chatId);
    if (chat) {
      const msg = { id: Date.now(), text, sender: 'me' };
      chat.messages.push(msg);
      saveDb();
      io.emit('data:update', db); // Updates control view instantly
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Handle React routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client_build', 'index.html'));
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
