import { WebSocketServer, WebSocket } from "ws";
import { server } from "./server";

const ws = new WebSocketServer({ server });

interface IMessage {
  type: string;
  roomname?: string;
  userName?: string;
  roomId?: string;
  streamId?: string;
}

function sendMessage(
  roomId: string | undefined,
  socket: WebSocket,
  msg: unknown,
) {
  if (!roomId) return;
  const room = rooms.get(roomId);
  if (!room) return;
  const recievers = room.clients.filter((s) => s.socket !== socket);
  recievers.forEach((r) => {
    if (r.socket.readyState === WebSocket.OPEN) {
      r.socket.send(JSON.stringify(msg));
    }
  });
}

type Room = {
  roomName: string;
  clients: {
    streamId: string;
    userName: string;
    socket: WebSocket;
  }[];
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
            clients: [
              {
                streamId: "",
                userName: "",
                socket,
              },
            ],
          });
          break;
        case "joinRoom":
          const currentRoom = rooms.get(roomId!);
          if (!currentRoom || !roomId || currentRoom.clients.length > 1) return;
          rooms.set(roomId, {
            roomName: currentRoom.roomName,
            clients: [
              ...currentRoom.clients,
              {
                userName: "",
                streamId: "",
                socket,
              },
            ],
          });
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(
              JSON.stringify({
                type: "self-joined",
                roomId,
                roomName: currentRoom.roomName,
                clients: currentRoom.clients.filter((c) => c.socket !== socket),
              }),
            );
          }
          sendMessage(roomId, socket, {
            type: "joined",
            userName: parsed.userName,
          });
          break;
        default:
          if (type === "joined-metadata") {
            const room = rooms.get(roomId!);
            const currentClient = room?.clients.find(
              (c) => c.socket === socket,
            );
            if (currentClient) {
              currentClient.streamId = parsed.streamId!;
              currentClient.userName = parsed.userName!;
            }
          }
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
