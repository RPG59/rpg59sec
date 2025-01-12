import { Command } from "commander";

import { client } from "./client";
import { server } from "./server";

const program = new Command();

const MAX_PORT = 65535;

program
  .command("client")
  .requiredOption("-h, --host <string>", "hostname")
  .requiredOption("-p, --port <number>", "port number")
  .requiredOption("-a, --address <string>", "Tun ipv4 id address")
  .requiredOption("-b, --basic-auth <username:password>", "Basic auth")
  .action(async ({ port, host, basicAuth, address }) => {
    const portNumber = Number(port);

    if (Number.isNaN(portNumber) || port > MAX_PORT || port < 1) {
      throw new Error("Invalid Port");
    }

    const [username, password] = basicAuth.split(":");

    if (!username || !password) {
      throw new Error("Invalid Basic Auth Credentials");
    }

    await client(host, portNumber, address, { username, password });
  });

program
  .command("server")
  .requiredOption("-a, --address <string>", "Tun ipv4 id address")
  .requiredOption("-p, --port <number>", "port number")
  .requiredOption("-b, --basic-auth <username:password>", "Basic auth")
  .action(async ({ port, address, basicAuth }) => {
    const portNumber = Number(port);

    if (Number.isNaN(portNumber) || port > MAX_PORT || port < 1) {
      throw new Error("Invalid Port");
    }

    const [username, password] = basicAuth.split(":");

    if (!username || !password) {
      throw new Error("Invalid Basic Auth Credentials");
    }

    await server(port, address, { username, password });
  });

program.parse();
