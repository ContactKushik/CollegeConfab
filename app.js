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

let waitingusers = []; // Ensure this array is defined
let rooms = []; // Ensure this array is defined

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);
  socket.on("joinroom", function (room) {
    if (waitingusers.length > 0) {
      let partner = waitingusers.shift();
      const roomname = `${socket.id}-${partner.id}`;
      rooms.push(roomname);
      socket.join(roomname);
      partner.join(roomname);
      io.to(roomname).emit("joined", roomname);
      console.log("------------------")
      console.log(`room created ${roomname}`);
      console.log("--------------------")
    } else {
      waitingusers.push(socket);
    }

    socket.on("disconnect", function () {
      let index = waitingusers.findIndex(
        (waitingUser) => waitingUser.id === socket.id
      );
      waitingusers.splice(index, 1);
      
    });

    socket.on("message", function (data) {
      console.log(data);
      socket.broadcast.to(data.room).emit("message", data.message);
    });

    socket.on("signalingMessage", function (data) {
      console.log(data.room, data.message);
      socket.broadcast.to(data.room).emit("signalingMessage", data.message);
    });
  });

 
});

app.get("/", (req, res) => {
  res.render("index");
});

server.listen(3000, () => {
  console.log("Server is running on port 3000: http://localhost:3000");
});
