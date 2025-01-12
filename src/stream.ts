import {Transform, TransformCallback} from "node:stream";

export class FrameReadTransformer extends Transform {
    buffer = new Buffer(0);
    lengthPrefixBytes = 2;

    async _transform(chunk: Buffer, encoding: BufferEncoding, callback: TransformCallback) {
        this.buffer = Buffer.concat([this.buffer, chunk])

        this.transform();
        callback();
    }

    transform() {
        while (1) {
            if (this.buffer.length < this.lengthPrefixBytes) {
                break;
            }

            const messageLength = this.buffer.readUint16BE(0);

            if (this.buffer.length < messageLength + this.lengthPrefixBytes) {
                break;
            }

            this.push(this.buffer.slice(this.lengthPrefixBytes, messageLength + this.lengthPrefixBytes));
            this.buffer = this.buffer.slice(this.lengthPrefixBytes + messageLength);
        }
    }
}

export class FrameWriteTransformer extends Transform {
    lengthPrefixBytes = 2;

    _transform(chunk: Buffer, encoding: BufferEncoding, callback: TransformCallback) {
        const lenBuffer = new Buffer(this.lengthPrefixBytes);
        lenBuffer.writeUint16BE(chunk.length)

        callback(null, Buffer.concat([lenBuffer, Buffer.from(chunk)]))
    }
}