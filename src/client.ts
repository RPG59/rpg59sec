import { ReadableStream } from "node:stream/web";
import { Tun } from "tuntap2";

import { ClientTransport } from "./clientTransport";
import { BasicAuthCreds, TransportStatus } from "./types";

export async function client(
  host: string,
  port: number,
  address: string,
  basicAuthCreds: BasicAuthCreds
) {
  const transport = new ClientTransport(
    `http://${host}:${port}`,
    basicAuthCreds
  );
  const stream = new ReadableStream(transport);
  const tunDevice = new Tun();
  const reader = stream.getReader();
  const transportStatus = (await reader.read()).value;

  if (new TextDecoder().decode(transportStatus) !== TransportStatus.OK) {
    throw new Error("Transport is not OK!");
  }

  reader.releaseLock();

  const startRead = async () => {
    for await (const message of stream) {
      tunDevice.write(Buffer.from(message.buffer));
    }
  };

  tunDevice.on("data", (data) => {
    transport.send(data);
  });

  tunDevice.ipv4 = address;
  tunDevice.isUp = true;

  await startRead();
}
