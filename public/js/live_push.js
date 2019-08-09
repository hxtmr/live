window.bufferEqual = function (b1, b2) {
    window.hasEqual = true
    var len = Math.min(b1.byteLength, b2.byteLength, 10000)
    var dv1 = new DataView(b1);
    var dv2 = new DataView(b2);
    for (var i = 0; i < len; i++) {
        console.log('index:', i, dv1.getUint8(i), dv2.getUint8(i), dv1.getUint8(i) == dv2.getUint8(i))

    }

}
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
        tmp.set(new Uint8Array(bufferArray[i], 0, bufferArray[i].length), offset);
        offset += bufferArray[i].byteLength;
    }
    return tmp.buffer;
};

var socket = io.connect()
var type = 'video/webm; codecs="vp9.0, vorbis"';

var catStream = null;
$(document).ready(function () {
        if(window.location.protocol!='https:'){
            alert("请使用https地址打开")
            return false;
        }
        if ('mediaDevices'in navigator && 'MediaSource' in window && MediaSource.isTypeSupported('video/webm;codecs=vp9')) {
        } else {
            alert('浏览器不支持MSE API,或者不支持vp9视频编码，推荐使用最新的Chrome或者firefox');
        }

        //console.log(navigator.mediaDevices.getSupportedConstraints())
        navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true
        }).then(function (stream) {
            //console.log(stream,video.firstChild.srcObject=stream)
            var video = $('#sv')[0]
            video.srcObject = stream;
            catStream = stream;//video.captureStream()
            video.play();
            doInit()
        }).catch(function (error) {
            console.log(error)
        })
        window.RecordClass = function (options, downloadButton) {
            var self = this;
            this.catchedBuffer = [];
            this.options = options || {video: {}, type: "video/webm;codecs=vp9,opus"}
            this.mediaSource = new MediaSource();
            this.sourceBuffer = null;
            this.recordedBlobs = [];
            this.mediaRecord = new MediaRecorder(catStream, {mimeType: self.options.type});
            if (this.options.video) {
                this.$video = $('<video muted autoplay></video>')
                this.$video.addClass(this.options.className || 'remote_video');
                this.video = this.$video[0]
                document.body.appendChild(this.video)
            }
            //private
            var onBufferLoad = function (e) {
                var reader = this;// ended
                if (self.sourceBuffer.updating !== true) {
                    try {
                        var buffer = reader.result;
                        if (self.catchedBuffer.length >= 1) {
                            var mbuffer = _appendBuffer(self.catchedBuffer, buffer)
                            self.catchedBuffer = []
                            self.sourceBuffer.appendBuffer(mbuffer)
                        } else {
                            self.sourceBuffer.appendBuffer(buffer)
                        }
                    } catch (e) {
                        console.log(e)
                        self.stop()
                    }
                } else {
                    self.catchedBuffer.push(reader.result)
                }
            }
            this.mediaRecord.ondataavailable = function (e) {
                self.recordedBlobs.push(e.data);
                var reader = new FileReader();
                reader.onload = onBufferLoad;
                socket.emit('receiveBuffer', e.data);
                reader.readAsArrayBuffer(e.data);
            }
            this.mediaRecord.onstart = function (e) {
                console.log('start')
            }
            this.mediaRecord.onstop = function (e) {
                console.log('stop')
                socket.emit('pushStop', 'stoped')


            }
            this.mediaSource.addEventListener('sourceopen', function () {
                self.sourceBuffer = self.mediaSource.addSourceBuffer(self.options.type);
                //sourceBuffer.mode="sequence";
                self.sourceBuffer.addEventListener('error', function (e) {
                    // console.log(e)
                })
                self.sourceBuffer.addEventListener('updateend', function (_) {
                    //console.log('end')
                    var promise = self.video.play();
                    if (promise !== undefined) {
                        promise.then(_ => {

                        }).catch(error => {
                            // console.log(error)
                        })
                        // Autoplay was prevented.
                        // Show a "Play" button so that user can start playback.
                    }
                    ;
                    // console.log(source.readyState); // ended
                });
                console.log('open')
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
            this.start = function (interval) {
                if (this.isStarted === true) {
                    this.stop()
                }
                this.attachVideo(function () {
                    self.recordedBlobs=[];
                    self.mediaRecord.start(interval)
                })
            }
            this.stop = function () {
                this.mediaRecord.stop()
            }
        }

        function doInit() {
            var interVal = $('.interval'),
                startBtn = $('.startBtn'),
                downBtn = $('.downBtn'),
                stopBtn = $('.stopBtn');
            var recordObj = window.recordObj = new RecordClass();
            startBtn.on('click', function () {
                socket.emit('queryStatus', interVal)
            })
            stopBtn.on('click', function () {
                stopBtn.attr('disabled', true)
                startBtn.attr('disabled', false)
                downBtn.attr('disabled', false)
                recordObj.stop()
            })
            downBtn.on('click', function () {
                if (recordObj.recordedBlobs.length > 0) {
                    var blob = new Blob(recordObj.recordedBlobs, {type: recordObj.options.type});
                    var url = window.URL.createObjectURL(blob);
                    var a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    a.download = (new Date().getTime() + '.webm');
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => {
                        document.body.removeChild(a);
                        window.URL.revokeObjectURL(url);
                    }, 1000);
                } else {
                    alert('没有可以下载的数据')
                }
            })
            socket.on('statusChange', function (data) {
                if (data.status != 'busy') {
                    startBtn.attr('disabled', true)
                    stopBtn.attr('disabled', false)
                    downBtn.attr('disabled', true)
                    recordObj.start(parseInt(interVal.val()))
                } else {
                    alert('别人正在直播，请你等一会儿吧！')
                }
            })
        }
    }
)
