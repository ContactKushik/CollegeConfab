const express = require("express");
const app = express();
const path = require("path");

const http = require("http");
const socketIO = require("socket.io");
const server = http.createServer(app);
const io = socketIO(server);

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.render("index");
});

let waitingusers = [];
let rooms = []; // Store rooms as an array of objects

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);
  console.log(`Total users connected: ${io.engine.clientsCount}.`);
  console.log(`Total rooms: ${rooms.length}`);

  // Handle user joining a room
  socket.on("joinroom", () => {
    joinRoom(socket);
  });

  // Handle "skip" functionality
  socket.on("skip", () => {
    handleSkip(socket);
  });

  // Handle user disconnect
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    console.log(
      `Total users connected: ${io.engine.clientsCount}. Total rooms: ${rooms.length}`
    );

    removeFromWaitingList(socket);
    handleDisconnection(socket);
  });

  socket.on("signalingMessage", function (data) {
    socket.broadcast.to(data.room).emit("signalingMessage", data.message);
  });
});

// Helper function to join a room
function joinRoom(socket) {
  if (waitingusers.length > 0) {
    let partner = waitingusers.shift(); // Get the first waiting user
    const roomname = `${socket.id}-${partner.id}`;

    // Create a room
    rooms.push({
      roomname: roomname,
      users: [socket.id, partner.id],
    });

    // Join both users to the room
    socket.join(roomname);
    partner.join(roomname);

    // Notify users of the room
    io.to(roomname).emit("joined", roomname);
    console.log(`Room created: ${roomname}. Total rooms: ${rooms.length}`);
  } else {
    waitingusers.push(socket);
  }
}

// Handle skip functionality
function handleSkip(socket) {
  console.log(`User ${socket.id} requested to skip`);

  let roomIndex = rooms.findIndex((room) => room.users.includes(socket.id));
  if (roomIndex !== -1) {
    const room = rooms[roomIndex];
    const remainingUserID = room.users.find((id) => id !== socket.id);

    // Remove the room
    rooms.splice(roomIndex, 1);

    const remainingUserSocket = io.sockets.sockets.get(remainingUserID);
    if (remainingUserSocket && remainingUserSocket.connected) {
      waitingusers.push(remainingUserSocket);
      remainingUserSocket.emit("skipped");
    }
  }

  joinRoom(socket);
}

// Handle user disconnection from a room
function handleDisconnection(socket) {
  let roomIndex = rooms.findIndex((room) => room.users.includes(socket.id));
  if (roomIndex !== -1) {
    const room = rooms[roomIndex];
    const remainingUserID = room.users.find((id) => id !== socket.id);

    // Remove the room
    rooms.splice(roomIndex, 1);

    const remainingUserSocket = io.sockets.sockets.get(remainingUserID);
    if (remainingUserSocket && remainingUserSocket.connected) {
      waitingusers.push(remainingUserSocket);
      remainingUserSocket.emit("skipped");
    }
  }
}

// Remove the user from the waiting list
function removeFromWaitingList(socket) {
  waitingusers = waitingusers.filter((user) => user.id !== socket.id);
}

server.listen(3000, () => {
  console.log("Server is running on port 3000: http://localhost:3000");
});
