import { WebSocketServer, WebSocket } from "ws";
import { server } from "./server";

const ws = new WebSocketServer({ server });

interface IMessage {
  type: string;
  roomname?: string;
  username?: string;
  roomId?: string;
}

function sendMessage(roomId: string | undefined, socket: WebSocket, msg: unknown) {
  if (!roomId) return;
  const room = rooms.get(roomId);
  if (!room) return;
  const recievers = room.clients.filter((s) => s !== socket);
  recievers.forEach((r) => {
    if (r.readyState === WebSocket.OPEN) {
      r.send(JSON.stringify(msg));
    }
  });
}

type Room = {
  roomName: string;
  clients: WebSocket[];
};
const rooms = new Map<string, Room>();

ws.on("connection", (socket: WebSocket) => {
  socket.on("message", (msg) => {
    try {
      const parsed = JSON.parse(msg.toString()) as IMessage;
      const { type, roomId } = parsed;
      switch (type) {
        case "createRoom":
          rooms.set(roomId!, {
            roomName: parsed.roomname!,
            clients: [socket],
          });
          break;
        case "joinRoom":
          const currentRoom = rooms.get(roomId!);
          if (!currentRoom || !roomId || currentRoom.clients.length > 1) return;
          rooms.set(roomId, {
            roomName: currentRoom.roomName,
            clients: [...currentRoom.clients, socket],
          });
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "self-joined", roomId, roomName: currentRoom.roomName}));
          }
          sendMessage(roomId, socket, { type: "joined", userName: parsed.username});
          break;
        default:
          sendMessage(roomId, socket, parsed);
      }
    } catch (e) {
      console.error(e);
    }
  });

  socket.on("close", (_, id) => {
    const roomId = id.toString();
    const room = rooms.get(roomId);
    if (!room) return;
    if (room.clients.length > 1) {
      room.clients.pop();
      rooms.set(roomId, room);
    } else {
      rooms.delete(roomId);
    }
  });
});
