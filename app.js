var status='empty';
var videoHeader = null;
var http = require('http');
var https = require('https');
var config = require('./config/live-config');
var fs = require("fs");
var express = require('express');
var path = require('path');
var ejs = require('ejs');//
var routes = require('./routes/index');
var app = express();

var privateKey = fs.readFileSync(path.join(__dirname, 'ssl/1539248837742.key'), 'utf8');
var certificate = fs.readFileSync(path.join(__dirname, 'ssl/1539248837742.pem'), 'utf8');
var credentials = {key: privateKey, cert: certificate};
var httpsServer = https.createServer(credentials, app);
var httpServer = http.createServer(app);
var io,client_io;

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
client_io=require('socket.io')(httpServer);
httpsServer.listen(app.get('port'), function () {
    console.log('HTTPS Server is running on port:', app.get('port'));
});
httpServer.listen(parseInt(app.get('port'))+1, function () {
    console.log('HTTP Server is running on port:%s', parseInt(app.get('port'))+1);
});
//直播socket
var marstSocket=null;
client_io.on('connection', function (socket) {
    console.log('a client joined')
})
io.on('connection', function (socket) {
    socket.emit('videoHeader', videoHeader)
    socket.on('getHeader', function (data) {
        // we tell the client to execute 'new message'
        socket.emit('videoHeader', videoHeader)
    });
    socket.on('receiveBuffer', function (data) {
        /*
         // 拷贝 `arr` 的内容
         const buf1 = Buffer.from(arr);

         // 与 `arr` 共享内存
         const buf2 = Buffer.from(arr.buffer);
         */
        //使用data.buffer生成的
        // Buffer.from(data)//与发送数据一样
        // Buffer.from(data.buffer)//与发送的数据不一样 前面多了一个04
        var bufferHeader = Buffer.from(data.buffer, 1, 189)
        var headerTag = Buffer.from(bufferHeader.buffer, 1, 4);
        //console.log('\n')
        //打印控制台分析视频流二进制格式
        /*   var b2=new Buffer(new Int8Array(b.buffer, 50,50));
           var b3=new Buffer(new Int8Array(b.buffer, 100,50));
           var b4=new Buffer(new Int8Array(b.buffer, 150,50));
           var b5=new Buffer(new Int8Array(b.buffer, 200,50));
           var b6= new Buffer(new Int8Array(b.buffer, 250,50));
           var b7=new Buffer(new Int8Array(b.buffer, 300,50));
           var b8=new Buffer(new Int8Array(b.buffer, 350,50));*/
        /* console.log(b1)
         console.log(b2)
         console.log(b3)
         console.log(b4)
         console.log(b5)
         console.log(b6)
         console.log(b7)
         console.log(b8)
         console.log('--')
         console.log(b1.readUInt8(0),b1.readUInt8(1),b1.readUInt8(2),b1.readUInt8(3))*/
        if (headerTag.readUInt8(0) == 26 && headerTag.readUInt8(1) == 69 && headerTag.readUInt8(2) == 223 && headerTag.readUInt8(3) == 163) {
            status='busy'
            videoHeader = bufferHeader//189视频头长度
            marstSocket=socket;
            marstSocket.on('disconnect',function () {
                console.log('status has changed')
                status='empty'
                socket.broadcast.emit('stop', '')
                client_io.emit('stop', '')
            })
        }
        socket.broadcast.emit('videobuffer', [data, videoHeader])
        client_io.emit('videobuffer', [data, videoHeader])
    })
    socket.on('pushStop', function (msg) {
        socket.broadcast.emit('stop', msg)
        client_io.emit('stop',msg)
        status='empty'

    })
    socket.on('queryStatus', function (msg) {
        socket.emit('statusChange',{status:status})
    })
});
