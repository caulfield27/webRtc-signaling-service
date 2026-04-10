import { WebSocketServer, WebSocket } from "ws";
import { server } from "./server";

const ws = new WebSocketServer({ server });

interface IMessage {
  type: string;
  roomname?: string;
  userName?: string;
  roomId?: string;
  streamId?: string;
  from?: string;
  to?: string;
}

function sendToAll(roomId: string | undefined, socket: WebSocket, data: unknown) {
  if (!roomId) return;
  const room = rooms.get(roomId);
  if (!room) return;
  room.clients
    .filter((r) => r.socket !== socket)
    .forEach((c) => {
      if (c.socket.readyState === WebSocket.OPEN) {
        c.socket.send(JSON.stringify(data));
      }
    });
}

function sendMessage(roomId: string | undefined, msg: IMessage) {
  if (!roomId) return;
  const room = rooms.get(roomId);
  if (!room) return;
  const to = msg.to!;
  const reciever = room.clients.find((c) => c.streamId === to);
  if (reciever?.socket?.readyState === WebSocket.OPEN) {
    reciever.socket.send(JSON.stringify(msg));
  }
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
      if (type === "createRoom") {
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
      } else if (type === "joinRoom") {
        const currentRoom = rooms.get(roomId!);
        if (!currentRoom || !roomId || currentRoom.clients.length > 3) return;
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
      } else if (type === "joined-metadata") {
        const room = rooms.get(roomId!);
        const currentClient = room?.clients.find((c) => c.socket === socket);
        if (currentClient) {
          currentClient.streamId = parsed.from!;
          currentClient.userName = parsed.userName!;
        }
        sendToAll(roomId, socket, parsed);
      } else if (type === "toggle-mute" || type === "toggle-video-off" || type === "chat-message") {
        sendToAll(roomId, socket, parsed);
      } else {
        sendMessage(roomId, parsed);
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
      const leaved = room.clients.pop();
      sendToAll(roomId, socket, {
        type: "disconnected",
        from: leaved?.streamId,
      });
      rooms.set(roomId, room);
    } else {
      rooms.delete(roomId);
    }
  });
});
