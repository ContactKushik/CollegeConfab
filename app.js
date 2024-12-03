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
let rooms = {}; // Use an object to store rooms

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);
  console.log(`Total users connected: ${io.engine.clientsCount}.`);
  console.log(`Total rooms: ${Object.keys(rooms).length}`);

  socket.on("joinroom", () => {
    if (waitingusers.length > 0) {
      let partner = waitingusers.shift(); // Get the first waiting user
      const roomname = `${socket.id}-${partner.id}`;

      rooms[roomname] = {
        roomname: roomname,
        users: [socket.id, partner.id],
      };

      socket.join(roomname);
      partner.join(roomname);

      io.to(roomname).emit("joined", roomname);
      console.log(
        `Room created: ${roomname}. Total rooms: ${Object.keys(rooms).length}`
      );
      console.log(`Total users connected: ${io.engine.clientsCount}.`);
      console.log(`Total rooms: ${Object.keys(rooms).length}`);
    } else {
      waitingusers.push(socket);
    }
  });

  socket.on("skip", () => {
    handleSkip(socket);
  });

  const handleSkip = (skippingSocket) => {
    // Find and remove the room associated with the skipping user
    let roomname = null;
    for (let key in rooms) {
      if (rooms[key].users.includes(skippingSocket.id)) {
        roomname = key;
        break;
      }
    }

    if (roomname) {
      const room = rooms[roomname];
      const partnerID = room.users.find((id) => id !== skippingSocket.id);
      const partnerSocket = io.sockets.sockets.get(partnerID);

      // Notify both users about the skip
      io.to(roomname).emit("skipNotice");

      // Leave the current room for both users
      skippingSocket.leave(roomname);
      if (partnerSocket) {
        partnerSocket.leave(roomname);
      }

      // Remove the room from rooms object
      delete rooms[roomname];

      // Make sure the partner is properly removed from the room and waiting list
      if (partnerSocket) {
        partnerSocket.emit("partnerLeft");
      }

      // Handle reconnecting or re-matching
      if (waitingusers.length > 0) {
        // Connect skipping user with another waiting user
        const newPartner = waitingusers.shift();
        const newRoomname = `${skippingSocket.id}-${newPartner.id}`;

        rooms[newRoomname] = {
          roomname: newRoomname,
          users: [skippingSocket.id, newPartner.id],
        };

        skippingSocket.join(newRoomname);
        newPartner.join(newRoomname);

        io.to(newRoomname).emit("joined", newRoomname);
        console.log(`New room created: ${newRoomname}.`);
      } else {
        // Add skipping user to waitingusers if no partner is found
        waitingusers.push(skippingSocket);
      }

      // Handle remaining partner
      if (partnerSocket) {
        if (waitingusers.length > 0) {
          const newPartner = waitingusers.shift();
          const newRoomname = `${partnerID}-${newPartner.id}`;

          rooms[newRoomname] = {
            roomname: newRoomname,
            users: [partnerID, newPartner.id],
          };

          partnerSocket.join(newRoomname);
          newPartner.join(newRoomname);

          io.to(newRoomname).emit("joined", newRoomname);
        } else {
          waitingusers.push(partnerSocket);
        }
      }
    } else {
      // If the skipping user was not in a room, add them to the waiting list
      if (!waitingusers.includes(skippingSocket)) {
        waitingusers.push(skippingSocket);
      }
    }
    console.log(`Skip handled. Total rooms: ${Object.keys(rooms).length}`);
      console.log(`Total users connected: ${io.engine.clientsCount}.`);
      console.log(`Total rooms: ${Object.keys(rooms).length}`);
  };

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
      console.log(`Total users connected: ${io.engine.clientsCount}.`);
      console.log(`Total rooms: ${Object.keys(rooms).length}`);
    // Remove from waiting list
    waitingusers = waitingusers.filter((user) => user.id !== socket.id);

    // Remove from rooms
    let roomname = null;
    for (let key in rooms) {
      if (rooms[key].users.includes(socket.id)) {
        roomname = key;
        break;
      }
    }

    if (roomname) {
      const room = rooms[roomname];
      delete rooms[roomname];

      const remainingUserID = room.users.find((id) => id !== socket.id);
      const remainingUserSocket = io.sockets.sockets.get(remainingUserID);
      if (remainingUserSocket) {
        waitingusers.push(remainingUserSocket);
      }
    }
  });

  socket.on("signalingMessage", function (data) {
    socket.broadcast.to(data.room).emit("signalingMessage", data.message);
  });
});

server.listen(3000, () => {
  console.log("Server is running on port 3000: http://localhost:3000");
});
