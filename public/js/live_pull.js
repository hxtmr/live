var MAX_TIME = 999999999999
/**
 * Creates a new Uint8Array based on two different ArrayBuffers
 *
 * @private
 * @param {ArrayBuffers} buffer1 The first buffer.
 * @param {ArrayBuffers} buffer2 The second buffer.
 * @return {ArrayBuffers} The new ArrayBuffer created out of the two.
 */
var _appendBuffer = window._appendBuffer = function (bufferArray, buffer2) {
    bufferArray.push(buffer2)
    var count = bufferArray.length;
    var buffLen = 0, offset = 0;
    for (var i = 0; i < count; i++) {
        buffLen += bufferArray[i].byteLength
    }
    var tmp = new Uint8Array(buffLen);
    for (var i = 0; i < count; i++) {
        tmp.set(new Uint8Array(bufferArray[i]), offset);
        offset += bufferArray[i].byteLength;
    }
    return tmp.buffer;
};
/*alert(MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E, mp4a.40.2"'))
alert(MediaSource.isTypeSupported('video/webm;codecs=vp9'))*/
if ('MediaSource' in window && MediaSource.isTypeSupported('video/webm;codecs=vp9')) {
} else {
    alert('浏览器不支持MSE API,或者不支持vp9视频编码，推荐使用最新的Chrome或者firefox');
}

$(document).ready(function () {
    function edgeBuffer(ber, hdata, target) {
        var tmp = new Uint8Array(ber.byteLength), clusterPos = -1;
        tmp.set(new Uint8Array(ber));
        if (tmp[0] == 26 && tmp[1] == 69 && tmp[2] == 223 && tmp[3] == 163) {
            target.sourceBuffer.hasAddHeader = true
            return ber;
        }
        for (var i = 0; i < tmp.byteLength; i++) {
            if (tmp[i] == 31 && tmp[i + 1] == 67 && tmp[i + 2] == 182 && tmp[i + 3] == 117) {
                clusterPos = i;
                break;
            }
        }
        if (clusterPos == -1) return null;
        var initSegBuffer = new Uint8Array(ber.byteLength - clusterPos)
        initSegBuffer.set(new Uint8Array(ber, clusterPos))
        target.video.currentTime = MAX_TIME;
        initSegBuffer = _appendBuffer([hdata], initSegBuffer);
        target.sourceBuffer.hasAddHeader = true
        return initSegBuffer
    }

    window.DecoderClass = function (options) {
        var self = this;
        this.socket = io.connect({transport: 'websocket'})
        this.socket.on('disconnect', function () {
            self.stop(function () {
                self.start()
            });
        })
        this.socket.on('stop', function () {
            console.log('stop')
            self.stop(function () {
                self.start()
            });
        })
        this.socket.on('connect', function () {
            self.start();
        })
        this.isStarted = false;
        this.catchedBuffer = [];
        this.options = options || {video: {}, type: type}
        this.mediaSource = new MediaSource();
        this.sourceBuffer = null;
        if (this.options.video) {
            this.$video = $('<video muted autoplay <!--controls-->></video>')
            this.$video.addClass(this.options.className || 'remote_video');
            this.video = this.$video[0]
            this.btn = $('<button style="display: none">开启声音</button>')
            this.status = $('<span>直播未开始</span>')
            $('body').append(this.btn).append(this.status).append('<br/>')
            document.body.appendChild(this.video)
            this.btn.on('click', function () {
                self.video.muted = false;
            })
        }
        //private
        var onBufferLoad = function (data) {
            var buffer = data[0]
            if (self.sourceBuffer.updating !== true) {
                try {
                    if (self.catchedBuffer.length >= 1) {
                        var mbuffer = _appendBuffer(self.catchedBuffer, buffer)
                        self.catchedBuffer = []
                        if (self.sourceBuffer.hasAddHeader == false) {
                            mbuffer = edgeBuffer(mbuffer, data[1], self)
                        }
                        if (mbuffer)
                            self.sourceBuffer.appendBuffer(mbuffer)
                    } else {
                        if (self.sourceBuffer.hasAddHeader == false) {
                            buffer = edgeBuffer(buffer, data[1], self)
                        }
                        if (buffer)
                            self.sourceBuffer.appendBuffer(buffer)
                    }
                } catch (e) {
                    console.log(e, '出错了，重新连接。。。')
                    self.stop()
                    if (self.sourceBuffer) {
                        self.sourceBuffer.hasAddHeader = false;
                    }
                    self.start();
                }

            } else {
                self.catchedBuffer.push(buffer)
            }
        }
        this.socket.on('videobuffer', function (data) {
            if (data[2] !== type) window.location.reload()//服务器视频格式不一致
            if (self.sourceBuffer)
                onBufferLoad(data)
        })

        this.mediaSource.addEventListener('sourceopen', function () {
            console.log('open')
            self.sourceBuffer = self.mediaSource.addSourceBuffer(self.options.type);
            self.sourceBuffer.hasAddHeader = false;
            self.sourceBuffer.addEventListener('error', function (e) {
                // console.log(e)
            })
            self.sourceBuffer.addEventListener('updateend', function (_) {
                var promise = self.video.play();
                if (promise !== undefined) {
                    promise.then(_ => {
                        self.status.html('直播中')
                        self.btn.show()
                    }).catch(error => {
                        // console.log(error)
                    })
                    // Autoplay was prevented.
                    // Show a "Play" button so that user can start playback.
                }
                ;
                // console.log(source.readyState); // ended
            });
        })
        this.attachVideo = function (callback) {
            this.video.src = "";
            this.video.srcObject = null;
            this.video.currentTime = 0
            this.video.src = URL.createObjectURL(this.mediaSource);
            if (callback)
                setTimeout(function () {
                    callback()
                }, 100)
        }
        this.start = function () {
            if (this.isStarted === true) {
                this.stop()
            }
            this.status.html('直播连接中')
            this.attachVideo(null)
        }
        this.stop = function (callback) {
            this.btn.hide()
            this.catchedBuffer = []
            this.video.muted = true;
            this.video.currentTime = 0;
            this.isStarted = false;
            if (this.sourceBuffer) {
                this.sourceBuffer.hasAddHeader = false;
            }
            if (callback)
                setTimeout(function () {
                    callback()
                }, 100)
        }
    }
    window.liveDecObj = new DecoderClass();
});
