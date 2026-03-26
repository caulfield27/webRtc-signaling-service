import { WebSocketServer, WebSocket } from "ws";
import { server } from "./server";

const ws = new WebSocketServer({ server });

interface IMessage {
  type: string;
  roomId?: string;
}

function sendMessage(
  roomId: string | undefined,
  socket: WebSocket,
  msg: unknown,
) {
  if (!roomId) return;
  const room = rooms.get(roomId);
  if (!room) return;
  const recievers = room.filter((s) => s !== socket);
  recievers.forEach((r) => {
    if (r.readyState === WebSocket.OPEN) {
      r.send(JSON.stringify(msg));
    }
  });
}

const rooms = new Map<string, WebSocket[]>();

ws.on("connection", (socket: WebSocket) => {
  socket.on("message", (msg) => {
    try {
      const parsed = JSON.parse(msg.toString()) as IMessage;
      const { type, roomId } = parsed;
      switch (type) {
        case "createRoom":
          rooms.set(roomId!, [socket]);
          break;
        case "joinRoom":
          const currentRoom = rooms.get(roomId!);
          if (!currentRoom || !roomId) return;
          rooms.set(roomId, [...currentRoom, socket]);
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "self-joined", roomId }));
          }
          sendMessage(roomId, socket, { type: "joined" });
          break;
        default:
          sendMessage(roomId, socket, parsed);
      }
    } catch (e) {
      console.error(e);
    }
  });
});
