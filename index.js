const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const http = require('http');
const qrcode = require('qrcode-terminal');

const app = express();
const server = http.createServer(app);

let client;

const startBot = async () => {
  const { state, saveState } = await useMultiFileAuthState('./auth_info');
  client = makeWASocket({
    auth: state,
    printQRInTerminal: true,
  });

  // Handle QR Code for pairing
  client.ev.on('qr', (qr) => {
    qrcode.generate(qr, { small: true }, (qrCode) => {
      console.log('Scan this QR code with your WhatsApp:', qrCode);
    });
  });

  // Handle connection and errors
  client.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
      console.log('Connection closed. Reconnecting...', lastDisconnect);
      if (lastDisconnect.error.output.statusCode !== 401) {
        startBot(); // Retry if not due to invalid session
      }
    } else if (connection === 'open') {
      console.log('WhatsApp Bot is connected');
    }
  });

  client.ev.on('chat-update', (chatUpdate) => {
    if (chatUpdate.messages) {
      const msg = chatUpdate.messages.all()[0];
      if (msg) {
        const text = msg.text;
        console.log('Received message:', text);
        // Handle video download or any other logic here
      }
    }
  });

  client.ev.on('messages.upsert', async (message) => {
    if (message.type === 'notify') {
      console.log('New message:', message);
      // Add logic to process message, for example, YouTube video download
    }
  });

  client.ev.on('connection.update', async (update) => {
    const { connection } = update;
    if (connection === 'open') {
      console.log('Bot connected');
    }
  });

  // Save the session state when changes occur
  client.ev.on('auth-state.update', (authState) => {
    saveState(authState);
  });
};

startBot();

app.get('/', (req, res) => {
  res.send('WhatsApp Bot is running...');
});

// Define server port
const port = process.env.PORT || 8080;
server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
