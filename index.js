const { default: makeWASocket, fetchLatestBaileysVersion, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const express = require('express');
const qrcode = require('qrcode');
const ytdl = require('ytdl-core');
const fs = require('fs');
const path = require('path');

// Initialize Express app
const app = express();
app.use(express.static('public')); // Serve static files like images

// WhatsApp bot setup
let qrCodeDataUrl = null;  // Variable to store the QR code image data URL

const startBot = async () => {
  const { state, saveState } = await useMultiFileAuthState('auth_info');

  // Fetch Baileys latest version
  const { version } = await fetchLatestBaileysVersion();

  // Create WhatsApp socket
  const sock = makeWASocket({
    auth: state,
    version
  });

  // Listen for QR code generation
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      // Generate QR code and store it as a Data URL
      qrcode.toDataURL(qr, (err, url) => {
        if (err) {
          console.log('Error generating QR code:', err);
        } else {
          qrCodeDataUrl = url; // Store the QR code image URL
        }
      });
    }

    if (connection === 'open') {
      console.log('Bot connected to WhatsApp!');
    }

    if (lastDisconnect?.error?.output?.statusCode === 401) {
      // Handle re-authentication
      console.log('QR expired, re-generating...');
      startBot();
    }
  });

  // Listen for incoming messages
  sock.ev.on('messages.upsert', async (msg) => {
    const message = msg.messages[0];
    const chat = message.key.remoteJid;

    if (message.message && message.message.conversation) {
      const text = message.message.conversation.trim();

      // Respond to a download request
      if (text.startsWith('!download ')) {
        const videoUrl = text.split(' ')[1];

        if (ytdl.validateURL(videoUrl)) {
          try {
            const info = await ytdl.getInfo(videoUrl);
            const title = info.videoDetails.title;

            const stream = ytdl(videoUrl, { filter: 'audioandvideo', quality: 'highest' });
            const outputPath = path.join(__dirname, `${title}.mp4`);
            const writeStream = fs.createWriteStream(outputPath);

            // Download the video
            stream.pipe(writeStream);

            writeStream.on('finish', () => {
              sock.sendMessage(chat, { text: `Download completed: ${title}` });
              sock.sendMessage(chat, { video: fs.createReadStream(outputPath), caption: title });
              fs.unlinkSync(outputPath); // Remove the file after sending
            });

          } catch (err) {
            sock.sendMessage(chat, { text: 'Error downloading video. Please try again later.' });
          }
        } else {
          sock.sendMessage(chat, { text: 'Invalid YouTube URL. Please try again with a valid link.' });
        }
      }
    }
  });

  // Save the state periodically
  sock.ev.on('auth-state.update', saveState);
};

// Start the bot
startBot();

// Set up the web server to serve the pairing page
app.get('/', (req, res) => {
  if (qrCodeDataUrl) {
    res.send(`
      <html>
        <head>
          <title>WhatsApp Bot Pairing</title>
        </head>
        <body>
          <h1>WhatsApp Bot Pairing</h1>
          <p>Scan the QR code to connect with the bot:</p>
          <img src="${qrCodeDataUrl}" alt="QR Code" />
          <p>Once connected, you can use the bot to download YouTube videos!</p>
        </body>
      </html>
    `);
  } else {
    res.send('<h1>QR Code is being generated...</h1>');
  }
});

// Start Express server on port 8080
app.listen(8080, () => {
  console.log('Web server is running on http://localhost:8080');
});
