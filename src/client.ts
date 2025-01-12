import { ReadableStream } from "node:stream/web";
import { Tun } from "tuntap2";

import { ClientTransportFactory } from "./clientTransport";
import { BasicAuthCreds, TransportStatus } from "./types";

export async function client(
  host: string,
  port: number,
  address: string,
  basicAuthCreds: BasicAuthCreds
) {
  const transport = await ClientTransportFactory(
    `http://${host}:${port}`,
    basicAuthCreds
  );
  const stream = new ReadableStream(transport);
  const tunDevice = new Tun();

  transport.send(TransportStatus.START);

  const startRead = async () => {
    for await (const message of stream) {
      tunDevice.write(message);
    }
  };

  tunDevice.on("data", (data: Buffer) => {
    transport.send(new Uint8Array(data));
  });

  tunDevice.ipv4 = address;
  tunDevice.isUp = true;

  await startRead();
}
