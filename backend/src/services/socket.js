import { Server } from 'socket.io';

let ioInstance = null;

function ticketRoom(showId) {
  return `ticket-show:${showId}`;
}

export function initSocket(server, clientOrigin) {
  ioInstance = new Server(server, {
    cors: { origin: clientOrigin, credentials: true },
  });

  ioInstance.on('connection', (socket) => {
    socket.on('announce', (message) => {
      ioInstance.emit('announcement', { message, at: Date.now() });
    });

    socket.on('tickets:join-show', (showId) => {
      if (showId) socket.join(ticketRoom(showId));
    });

    socket.on('tickets:leave-show', (showId) => {
      if (showId) socket.leave(ticketRoom(showId));
    });
  });

  return ioInstance;
}

export function emitTicketSeatMap(showId, payload) {
  ioInstance?.to(ticketRoom(showId)).emit('tickets:seat-map', payload);
}

