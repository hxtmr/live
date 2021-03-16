var status = 'empty';
var videoHeader = null;
var http = require('http');
var https = require('https');
var config = require('./config/live-config');
var fs = require("fs");
var express = require('express');
var path = require('path');
var ejs = require('ejs');//
var app = express();
app.sourceBufferType = 'video/webm;codecs=vp8,opus'
var routes = require('./routes/index')(app);
var vp8Header = Buffer.from('1A45DFA301', 'hex')
var vp9Header = Buffer.from('1A45DFA39F', 'hex')
var clusterHeader = Buffer.from('1f43b675', 'hex')
var privateKey = fs.readFileSync(path.join(__dirname, 'ssl/1539248837742.key'), 'utf8');
var certificate = fs.readFileSync(path.join(__dirname, 'ssl/1539248837742.pem'), 'utf8');
var credentials = {key: privateKey, cert: certificate};
var httpsServer = https.createServer(credentials, app);
var httpServer = http.createServer(app);
var io, client_io;

app.set('port', config.port || 443);
app.set('host', config.host);
//gzip支持
//app.use(express.compress());
app.set('views', __dirname + '/views');
app.engine('.html', ejs.__express);
app.set('view engine', 'html');

app.use(express.static(path.join(__dirname, 'public')));
app.use('/', routes);

io = require('socket.io')(httpsServer);
client_io = require('socket.io')(httpServer);
httpsServer.listen(app.get('port'), function () {
    console.log('HTTPS Server is running on port:', app.get('port'));
});
httpServer.listen(parseInt(app.get('port')) + 1, function () {
    console.log('HTTP Server is running on port:%s', parseInt(app.get('port')) + 1);
});
//直播socket
var marstSocket = null;
client_io.on('connection', function (socket) {
    console.log('a client joined')
})
io.on('connection', function (socket) {
    socket.emit('videoHeader', videoHeader)
    socket.on('getHeader', function (data) {
        // we tell the client to execute 'new message'
        socket.emit('videoHeader', videoHeader)
    });

    /*
    <Buffer 1a 45 df a3 9f 42 86 81 01 42 f7 81 01 42 f2 81 04 42 f3 81 08 42 82 84 77 65 62 6d 42 87 81 04 42 85 81 02 18 53 80 67 01 ff ff ff ff ff ff ff 15 49 ... 26313 more byte
s>
26363
ArrayBuffer {
  [Uint8Contents]: <04 1a 45 df a3 9f 42 86 81 01 42 f7 81 01 42 f2 81 04 42 f3 81 08 42 82 84 77 65 62 6d 42 87 81 04 42 85 81 02 18 53 80 67 01 ff ff ff ff ff ff ff 15 49 a9 6
6 99 2a d7 b1 83 0f 42 40 4d 80 86 43 68 72 6f 6d 65 57 41 86 43 68 72 6f 6d 65 16 54 ae 6b ea ae bd d7 81 01 73 c5 87 c2 3c 3f 4c 9e 02 7f 83 ... 26264 more bytes>,
  byteLength: 26364
}

     */
    socket.on('receiveBuffer', function (data) {
        // var bufferHeader = Buffer.slice(data, 0, 189)
        console.log(data)
        var buffer = Buffer.from(data)
        var headerTag = buffer.slice(0, 5);
        //var bufferHeader;
        // console.log(headerTag)
        // console.log(vp8HeaderTag)
        /*  console.log(bufferHeader)
          var b = bufferHeader
          //打印控制台分析视频流二进制格式
          var b1 = new Buffer(new Int8Array(b.buffer, 0, 50));
          var b2 = new Buffer(new Int8Array(b.buffer, 50, 50));
          var b3 = new Buffer(new Int8Array(b.buffer, 100, 50));
          var b4 = new Buffer(new Int8Array(b.buffer, 150, 50));
          var b5 = new Buffer(new Int8Array(b.buffer, 200, 50));
          var b6 = new Buffer(new Int8Array(b.buffer, 250, 50));
          var b7 = new Buffer(new Int8Array(b.buffer, 300, 50));
          var b8 = new Buffer(new Int8Array(b.buffer, 350, 50));
          console.log(b1)
          console.log(b2)
          console.log(b3)
          console.log(b4)
          console.log(b5)
          console.log(b6)
          console.log(b7)
          console.log(b8)
          console.log('--')*/
        //console.log(b1.readUInt8(0), b1.readUInt8(1), b1.readUInt8(2), b1.readUInt8(3))
        //console.log(b1.readUInt8(4), b1.readUInt8(6), b1.readUInt8(7), b1.readUInt8(7))
        let isHeader = false
        if (headerTag.equals(vp9Header)) {
            console.log('vp9')
            isHeader = true;
            app.sourceBufferType = 'video/webm;codecs=vp9,opus'
            videoHeader = buffer.slice(0, 189)
        } else if (headerTag.equals(vp8Header)) {//#2  Firefox: can only play
            console.log('vp8')
            isHeader = true
            app.sourceBufferType = 'video/webm;codecs=vp8,opus'
            videoHeader = buffer.slice(0, 313)
        }
        if (isHeader) {
            status = 'busy'
            /* videoHeader = bufferHeader//189视频头长度*/
            marstSocket = socket;
            marstSocket.on('disconnect', function () {
                console.log('status has changed')
                status = 'empty'
                socket.broadcast.emit('stop', '')
                client_io.emit('stop', '')
            })
        }
        socket.broadcast.emit('videobuffer', [data, videoHeader, app.sourceBufferType])
        client_io.emit('videobuffer', [data, videoHeader])
    })
    socket.on('pushStop', function (msg) {
        socket.broadcast.emit('stop', msg)
        client_io.emit('stop', msg)
        status = 'empty'

    })
    socket.on('queryStatus', function (msg) {
        socket.emit('statusChange', {status: status})
    })
});
