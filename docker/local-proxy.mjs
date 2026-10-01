// Tiny TCP forwarder: 127.0.0.1:<port> -> <host>:<targetPort>
import net from "node:net";
const [port, host, target] = process.argv.slice(2);
net
  .createServer((c) => {
    const u = net.connect(Number(target), host);
    c.pipe(u).pipe(c);
    c.on("error", () => u.destroy());
    u.on("error", () => c.destroy());
  })
  .listen(Number(port), "127.0.0.1");
