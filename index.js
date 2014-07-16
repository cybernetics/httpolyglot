var http = require('http'),
    https = require('https'),
    inherits = require('util').inherits;

function Server(tlsconfig, requestListener) {
  if (!(this instanceof Server))
    return new Server(tlsconfig, requestListener);

  if (typeof tlsconfig === 'function') {
    requestListener = tlsconfig;
    tlsconfig = undefined;
  }

  if (typeof tlsconfig === 'object') {
    this.removeAllListeners('connection');

    https.Server.call(this, tlsconfig, requestListener);

    // capture https socket handler, it's not exported like http's socket
    // handler
    var connev = this._events.connection;
    if (typeof connev === 'function')
      this._tlsHandler = connev;
    else
      this._tlsHandler = connev[connev.length - 1];
    this.removeListener('connection', this._tlsHandler);

    this.on('connection', connectionListener);
    this.on('secureConnection', http._connectionListener);

    // copy from http.Server
    this.timeout = 2 * 60 * 1000;
    this.allowHalfOpen = true;
    this.httpAllowHalfOpen = false;
  } else
    http.Server.call(this, requestListener);
}
inherits(Server, https.Server);

Server.prototype.setTimeout = function(msecs, callback) {
  this.timeout = msecs;
  if (callback)
    this.on('timeout', callback);
};

function connectionListener(socket) {
  var self = this;
  socket.ondata = function(d, start, end) {
    if (d[start] < 32) {
      // tls/ssl
      socket.ondata = null;
      self._tlsHandler(socket);
      socket.push(d.slice(start, end));
    } else {
      http._connectionListener.call(self, socket);
      socket.ondata(d, start, end);
    }
  };
}

exports.Server = Server;

exports.createServer = function(tlsconfig, requestListener) {
  return new Server(tlsconfig, requestListener);
};